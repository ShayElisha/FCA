import type { Browser, Page } from 'playwright-core'
import { applyCdpStealth } from './stealth-cdp.js'

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
    // Core anti-detection
    '--disable-blink-features=AutomationControlled',
    '--exclude-switches=enable-automation',
    '--disable-automation',
    
    // Security (required for containers)
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    
    // Rendering
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-dev-tools',
    '--window-size=1920,1080',
    '--window-position=0,0',
    '--force-color-profile=srgb',
    '--force-device-scale-factor=1',
    
    // Features to disable
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process,TranslateUI,BlinkGenPropertyTrees',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-background-networking',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    
    // Features to enable
    '--enable-features=NetworkService,NetworkServiceInProcess',
    
    // Performance
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--no-pings',
    '--password-store=basic',
    '--use-mock-keychain',
    '--export-tagged-pdf',
    
    // Misc
    '--hide-scrollbars',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--allow-running-insecure-content',
    '--disable-blink-features=AutomationControlled',
    '--user-agent-override',
  ]

  // ALWAYS prefer branded Google Chrome (local + Docker/Railway) — carrier sites block bundled Chromium
  if (preferChrome && process.env.SCRAPE_FORCE_BUNDLED !== '1') {
    try {
      console.log('🔍 Attempting to launch real Chrome (recommended for bypass)...')
      const browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
        args: chromeArgs,
      })
      console.log('✅ Real Chrome launched successfully')
      return browser
    } catch (error) {
      console.warn('⚠️  Real Chrome not found, falling back to Chromium (may be blocked)')
      console.warn('   Install Chrome: https://www.google.com/chrome/')
      console.warn('   Or set SCRAPE_FORCE_BUNDLED=1 to suppress this warning')
      // Fall through to Playwright-bundled Chromium
    }
  }

  console.log('⚠️  Using bundled Chromium (carriers may block this)')
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
    // Ultra-aggressive anti-detection
    
    // 1. Remove ALL webdriver traces
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    delete (navigator as any).__proto__.webdriver
    delete (window as any).navigator.webdriver
    
    // 2. Override automation flags
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 })
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 })
    
    // 3. Comprehensive plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: { name: 'Chrome PDF Plugin' } },
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

    // 4. Languages and platform
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    })
    Object.defineProperty(navigator, 'language', {
      get: () => 'en-US',
    })

    // 5. Permissions override
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters)

    // 6. Full Chrome object
    ;(window as any).chrome = {
      runtime: {
        PlatformOs: {
          MAC: 'mac',
          WIN: 'win',
          ANDROID: 'android',
          CROS: 'cros',
          LINUX: 'linux',
          OPENBSD: 'openbsd',
        },
        PlatformArch: {
          ARM: 'arm',
          X86_32: 'x86-32',
          X86_64: 'x86-64',
        },
        PlatformNaclArch: {
          ARM: 'arm',
          X86_32: 'x86-32',
          X86_64: 'x86-64',
        },
        RequestUpdateCheckStatus: {
          THROTTLED: 'throttled',
          NO_UPDATE: 'no_update',
          UPDATE_AVAILABLE: 'update_available',
        },
        OnInstalledReason: {
          INSTALL: 'install',
          UPDATE: 'update',
          CHROME_UPDATE: 'chrome_update',
          SHARED_MODULE_UPDATE: 'shared_module_update',
        },
        OnRestartRequiredReason: {
          APP_UPDATE: 'app_update',
          OS_UPDATE: 'os_update',
          PERIODIC: 'periodic',
        },
      },
      loadTimes: () => ({
        requestTime: Date.now() / 1000 - Math.random(),
        startLoadTime: Date.now() / 1000 - Math.random(),
        commitLoadTime: Date.now() / 1000 - Math.random(),
        finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
        finishLoadTime: Date.now() / 1000 - Math.random(),
        firstPaintTime: Date.now() / 1000 - Math.random(),
        firstPaintAfterLoadTime: 0,
        navigationType: 'Other',
        wasFetchedViaSpdy: false,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2',
        wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2',
      }),
      csi: () => ({
        startE: Date.now(),
        onloadT: Date.now(),
        pageT: Date.now() - Math.random() * 1000,
        tran: 15,
      }),
      app: {
        isInstalled: false,
        InstallState: {
          DISABLED: 'disabled',
          INSTALLED: 'installed',
          NOT_INSTALLED: 'not_installed',
        },
        RunningState: {
          CANNOT_RUN: 'cannot_run',
          READY_TO_RUN: 'ready_to_run',
          RUNNING: 'running',
        },
      },
    }

    // 7. WebGL vendor and renderer
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
    
    const getParameter2 = WebGL2RenderingContext.prototype.getParameter
    WebGL2RenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) {
        return 'Intel Inc.'
      }
      if (parameter === 37446) {
        return 'Intel Iris OpenGL Engine'
      }
      return getParameter2.call(this, parameter)
    }

    // 8. Canvas fingerprint randomization with noise
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
      const context = this.getContext('2d')
      if (context && this.width > 0 && this.height > 0) {
        const imageData = context.getImageData(0, 0, this.width, this.height)
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] = imageData.data[i] + Math.floor(Math.random() * 5) - 2
          imageData.data[i + 1] = imageData.data[i + 1] + Math.floor(Math.random() * 5) - 2
          imageData.data[i + 2] = imageData.data[i + 2] + Math.floor(Math.random() * 5) - 2
        }
        context.putImageData(imageData, 0, 0)
      }
      return originalToDataURL.apply(this, args)
    }
    
    // 9. Battery API
    if ('getBattery' in navigator) {
      const originalGetBattery = (navigator as any).getBattery
      ;(navigator as any).getBattery = async () => {
        const battery = await originalGetBattery.call(navigator)
        Object.defineProperty(battery, 'charging', { get: () => true })
        Object.defineProperty(battery, 'chargingTime', { get: () => 0 })
        Object.defineProperty(battery, 'dischargingTime', { get: () => Infinity })
        Object.defineProperty(battery, 'level', { get: () => 1 })
        return battery
      }
    }
    
    // 10. Connection API
    if ('connection' in navigator) {
      Object.defineProperty((navigator as any).connection, 'rtt', { get: () => 100 })
      Object.defineProperty((navigator as any).connection, 'downlink', { get: () => 10 })
      Object.defineProperty((navigator as any).connection, 'effectiveType', { get: () => '4g' })
    }
    
    // 11. Media devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices
      navigator.mediaDevices.enumerateDevices = async () => {
        const devices = await originalEnumerateDevices.call(navigator.mediaDevices)
        return devices.length > 0 ? devices : [
          { deviceId: 'default', groupId: 'default', kind: 'audioinput' as MediaDeviceKind, label: '' },
          { deviceId: 'default', groupId: 'default', kind: 'videoinput' as MediaDeviceKind, label: '' },
        ]
      }
    }
    
    // 12. Screen properties
    Object.defineProperty(screen, 'availWidth', { get: () => screen.width })
    Object.defineProperty(screen, 'availHeight', { get: () => screen.height })
    Object.defineProperty(screen, 'availTop', { get: () => 0 })
    Object.defineProperty(screen, 'availLeft', { get: () => 0 })
    
    // 13. Date override for timezone consistency
    const originalDate = Date
    const offset = new Date().getTimezoneOffset()
    
    // 14. Remove automation console messages
    const originalConsoleDebug = console.debug
    console.debug = (...args: any[]) => {
      if (args[0]?.includes?.('DevTools')) return
      return originalConsoleDebug.apply(console, args)
    }
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

  // Apply ultra-stealth patches
  await addStealthScripts(context)
  await applyCdpStealth(context)
  
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
