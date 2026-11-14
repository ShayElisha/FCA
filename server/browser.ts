import type { Browser, Page } from 'playwright-core'

const isServerless =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  process.env.SCRAPE_MODE === 'serverless'

const preferChrome =
  process.env.SCRAPE_MODE === 'chrome' ||
  (!isServerless && process.env.SCRAPE_MODE !== 'serverless')

const PAGE_TIMEOUT_MS = Number(process.env.SCRAPE_PAGE_TIMEOUT_MS ?? 20000)

function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:132.0) Gecko/20100101 Firefox/132.0',
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

async function launchBrowser(): Promise<Browser> {
  // Serverless Chromium (Vercel) — often blocked by carrier bot protection (e.g. MSC/Akamai)
  if (isServerless && process.env.SCRAPE_MODE !== 'chrome') {
    const chromium = (await import('@sparticuz/chromium')).default
    const { chromium: playwright } = await import('playwright-core')

    return playwright.launch({
      args: [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled',
        '--disable-gpu',
        '--no-zygote',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-setuid-sandbox',
      ],
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  // Real browser on a persistent host (local Chrome, or Playwright image in Docker/Railway)
  const { chromium } = await import('playwright')

  const chromeArgs = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-setuid-sandbox',
    '--window-size=1920,1080',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-extensions',
    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
    '--disable-ipc-flooding-protection',
    '--disable-renderer-backgrounding',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    '--force-color-profile=srgb',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--password-store=basic',
    '--use-mock-keychain',
    '--export-tagged-pdf',
  ]

  // Prefer branded Google Chrome (local + Docker/Railway) — MSC/Akamai blocks bundled Chromium
  if (preferChrome && process.env.SCRAPE_FORCE_BUNDLED !== '1') {
    try {
      return await chromium.launch({
        channel: 'chrome',
        headless: true,
        args: chromeArgs,
      })
    } catch {
      // Fall through to Playwright-bundled Chromium
    }
  }

  return chromium.launch({
    headless: true,
    args: chromeArgs,
  })
}

async function speedUpPage(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const type = route.request().resourceType()
    if (
      type === 'image' ||
      type === 'media' ||
      type === 'font' ||
      type === 'texttrack' ||
      type === 'eventsource' ||
      type === 'websocket' ||
      type === 'manifest'
    ) {
      return route.abort()
    }
    const url = route.request().url()
    if (
      /google-analytics|googletagmanager|facebook|hotjar|optimizely|segment\.com|clarity\.ms/i.test(
        url,
      )
    ) {
      return route.abort()
    }
    return route.continue()
  })
}

async function addStealthScripts(context: any): Promise<void> {
  await context.addInitScript(() => {
    // Remove webdriver property
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 1,
          name: 'Chrome PDF Plugin',
        },
        {
          0: { type: 'application/pdf', suffixes: 'pdf', description: '' },
          description: '',
          filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
          length: 1,
          name: 'Chrome PDF Viewer',
        },
        {
          0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
          1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
          description: '',
          filename: 'internal-nacl-plugin',
          length: 2,
          name: 'Native Client',
        },
      ],
    })

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    })

    // Override permissions
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters)

    // Chrome object
    ;(window as any).chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {},
    }

    // WebGL vendor override
    const getParameter = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) {
        return 'Intel Inc.'
      }
      if (parameter === 37446) {
        return 'Intel Iris OpenGL Engine'
      }
      return getParameter.call(this, parameter)
    }

    // Canvas fingerprint randomization
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      const context = this.getContext('2d')
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height)
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] = imageData.data[i] + Math.floor(Math.random() * 3) - 1
        }
        context.putImageData(imageData, 0, 0)
      }
      return originalToDataURL.apply(this, args)
    }

    // Remove automation indicators
    delete (navigator as any).__proto__.webdriver
  })
}

export async function withPage<T>(
  fn: (page: Page) => Promise<T>,
  timeoutMs = PAGE_TIMEOUT_MS,
): Promise<T> {
  const browser = await launchBrowser()
  const userAgent = getRandomUserAgent()
  
  const context = await browser.newContext({
    locale: 'en-US',
    userAgent,
    viewport: { 
      width: 1920, 
      height: 1080,
    },
    deviceScaleFactor: 1,
    javaScriptEnabled: true,
    hasTouch: false,
    isMobile: false,
    timezoneId: 'America/New_York',
    permissions: [],
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    },
  })

  await addStealthScripts(context)
  
  const page = await context.newPage()
  page.setDefaultTimeout(timeoutMs)
  page.setDefaultNavigationTimeout(timeoutMs)
  await speedUpPage(page)

  try {
    return await fn(page)
  } finally {
    await context.close().catch(() => undefined)
    await browser.close().catch(() => undefined)
  }
}

export async function closeBrowser(): Promise<void> {
  // Fresh browser per request.
}
