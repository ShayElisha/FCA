import type { Browser, Page } from 'playwright-core'

const isServerless =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  process.env.SCRAPE_MODE === 'serverless'

const PAGE_TIMEOUT_MS = Number(process.env.SCRAPE_PAGE_TIMEOUT_MS ?? 20000)

async function launchBrowser(): Promise<Browser> {
  if (isServerless) {
    const chromium = (await import('@sparticuz/chromium')).default
    const { chromium: playwright } = await import('playwright-core')

    return playwright.launch({
      args: [...chromium.args, '--disable-gpu', '--no-zygote'],
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  // Prefer installed Google Chrome — Akamai blocks Playwright's bundled Chromium
  const { chromium } = await import('playwright')
  try {
    return await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    })
  } catch {
    return chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    })
  }
}

async function speedUpPage(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const type = route.request().resourceType()
    // Keep stylesheet — some SPAs need it; still block heavy media
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

export async function withPage<T>(
  fn: (page: Page) => Promise<T>,
  timeoutMs = PAGE_TIMEOUT_MS,
): Promise<T> {
  const browser = await launchBrowser()
  const context = await browser.newContext({
    locale: 'en-US',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
    javaScriptEnabled: true,
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
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
