/**
 * Clean Browser Configuration
 * 
 * Simplified Playwright browser without aggressive bypass techniques.
 * Uses legitimate configuration that's less likely to be blocked.
 * 
 * Key differences from browser.ts:
 * - NO UniversalBypass
 * - NO stealth-cdp manipulation
 * - NO fingerprint spoofing
 * - Simple, clean Playwright configuration
 * 
 * Trade-off:
 * - May not work on sites with aggressive bot protection
 * - But much less likely to be detected and blocked
 * - More stable and maintainable
 */

import type { Browser, Page, BrowserContext } from 'playwright-core'

const isServerless =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  process.env.SCRAPE_MODE === 'serverless'

const PAGE_TIMEOUT_MS = Number(process.env.SCRAPE_PAGE_TIMEOUT_MS ?? 30000)

/**
 * Get a clean, realistic user agent
 */
function getCleanUserAgent(): string {
  // Use a stable, common user agent - no rotation
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
}

/**
 * Launch browser with clean configuration
 */
async function launchCleanBrowser(): Promise<Browser> {
  if (isServerless && process.env.SCRAPE_MODE !== 'chrome') {
    // Serverless environment (Vercel)
    const chromium = (await import('@sparticuz/chromium')).default
    const { chromium: playwright } = await import('playwright-core')

    return playwright.launch({
      args: [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  // Local/persistent environment
  const { chromium } = await import('playwright')

  return chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  })
}

/**
 * Create browser context with clean configuration
 */
async function createCleanContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: getCleanUserAgent(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    javaScriptEnabled: true,
    acceptDownloads: false,
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    },
  })

  context.setDefaultTimeout(PAGE_TIMEOUT_MS)
  context.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS)

  return context
}

/**
 * Execute operation with a clean page
 */
export async function withCleanPage<T>(
  fn: (page: Page) => Promise<T>,
  timeoutMs = PAGE_TIMEOUT_MS,
): Promise<T> {
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null

  try {
    browser = await launchCleanBrowser()
    context = await createCleanContext(browser)
    page = await context.newPage()

    page.setDefaultTimeout(timeoutMs)
    page.setDefaultNavigationTimeout(timeoutMs)

    // Simple page optimization - block unnecessary resources
    await page.route('**/*', (route) => {
      const type = route.request().resourceType()
      // Block images, fonts, media to speed up loading
      if (['image', 'font', 'media'].includes(type)) {
        route.abort()
      } else {
        route.continue()
      }
    })

    return await fn(page)
  } finally {
    // Cleanup
    if (page) await page.close().catch(() => undefined)
    if (context) await context.close().catch(() => undefined)
    if (browser) await browser.close().catch(() => undefined)
  }
}

/**
 * Execute operation with clean page - no resource blocking
 * (some sites don't work well with resource blocking)
 */
export async function withCleanPageNoBlock<T>(
  fn: (page: Page) => Promise<T>,
  timeoutMs = PAGE_TIMEOUT_MS,
): Promise<T> {
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null

  try {
    browser = await launchCleanBrowser()
    context = await createCleanContext(browser)
    page = await context.newPage()

    page.setDefaultTimeout(timeoutMs)
    page.setDefaultNavigationTimeout(timeoutMs)

    return await fn(page)
  } finally {
    if (page) await page.close().catch(() => undefined)
    if (context) await context.close().catch(() => undefined)
    if (browser) await browser.close().catch(() => undefined)
  }
}

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  module: 'browser-clean',
  message: 'Clean browser module loaded',
  serverless: isServerless,
}))
