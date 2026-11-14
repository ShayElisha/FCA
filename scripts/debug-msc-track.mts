import { chromium } from 'playwright'

const container = process.argv[2] ?? 'MSCU6789016'

const browser = await chromium.launch({
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
})
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1400, height: 900 },
  locale: 'en-US',
})
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
})
const page = await context.newPage()

page.on('response', async (res) => {
  const url = res.url()
  const req = res.request()
  if (req.method() !== 'POST') return
  if (/metrics|google|facebook|collect/i.test(url)) return
  try {
    const body = req.postData() ?? ''
    const text = await res.text()
    if (
      /tracking|container|shipment|IsSuccess|bill/i.test(url + body + text)
    ) {
      console.log('\n=== HIT ===')
      console.log(res.status(), url)
      console.log('POST', body.slice(0, 500))
      console.log('RESP', text.slice(0, 1500))
    }
  } catch {
    // ignore
  }
})

await page.goto('https://www.msc.com/en/track-a-shipment', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
})
await page.waitForTimeout(2000)

// Accept cookies if present
const accept = page.locator(
  'button:has-text("Accept"), button:has-text("Agree"), #onetrust-accept-btn-handler',
).first()
if (await accept.isVisible().catch(() => false)) {
  await accept.click().catch(() => undefined)
  await page.waitForTimeout(500)
}

const input = page
  .locator(
    'input[placeholder*="Container" i], input[name*="tracking" i], input[aria-label*="Container" i], input[type="text"]',
  )
  .first()
await input.waitFor({ state: 'visible', timeout: 15000 })
await input.click()
await input.fill(container)

const trackBtn = page
  .locator('button:has-text("Track"), button:has-text("Search")')
  .first()
if (await trackBtn.count()) await trackBtn.click()
else await page.keyboard.press('Enter')

await page.waitForTimeout(8000)
const text = await page.locator('body').innerText()
console.log('\n=== BODY ===\n', text.slice(0, 2500))

await browser.close()
