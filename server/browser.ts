import type { Browser, Page } from 'playwright-core'

const isServerless =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  process.env.SCRAPE_MODE === 'serverless'

async function launchBrowser(): Promise<Browser> {
  if (isServerless) {
    const chromium = (await import('@sparticuz/chromium')).default
    const { chromium: playwright } = await import('playwright-core')

    return playwright.launch({
      args: [...chromium.args, '--disable-gpu'],
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  // Local / long-running Node server: use full Playwright browsers
  const { chromium } = await import('playwright')
  return chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })
}

export async function withPage<T>(
  fn: (page: Page) => Promise<T>,
  timeoutMs = 35000,
): Promise<T> {
  const browser = await launchBrowser()
  const context = await browser.newContext({
    locale: 'en-US',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1365, height: 900 },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(timeoutMs)

  try {
    return await fn(page)
  } finally {
    await context.close().catch(() => undefined)
    await browser.close().catch(() => undefined)
  }
}

export async function closeBrowser(): Promise<void> {
  // Serverless launches a fresh browser per request; nothing to keep warm.
}
