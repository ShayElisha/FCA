import { chromium, type Browser, type Page } from 'playwright'

let browserPromise: Promise<Browser> | null = null

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    })
  }
  return browserPromise
}

export async function withPage<T>(
  fn: (page: Page) => Promise<T>,
  timeoutMs = 45000,
): Promise<T> {
  const browser = await getBrowser()
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
    await context.close()
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return
  const browser = await browserPromise
  browserPromise = null
  await browser.close()
}
