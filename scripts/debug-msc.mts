import { chromium } from 'playwright'
import { pageLooksBlocked } from '../server/parse.ts'

const container = process.argv[2] ?? 'MSCU6789016'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const responses: { url: string; status: number; preview: string }[] = []

page.on('response', async (res) => {
  const url = res.url()
  if (!/msc\.com|track|shipment|container/i.test(url)) return
  if (!/json|api|graphql|track/i.test(url) && !url.includes('track')) return
  try {
    const ct = res.headers()['content-type'] ?? ''
    if (!/json|text|xml/i.test(ct)) return
    const text = await res.text()
    responses.push({
      url: url.slice(0, 180),
      status: res.status(),
      preview: text.slice(0, 400),
    })
  } catch {
    // ignore
  }
})

const url = `https://www.msc.com/en/track-a-shipment?trackingNumber=${container}`
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(3000)

let text = await page.locator('body').innerText()
console.log('--- blocked?', pageLooksBlocked(text))
console.log('--- cloudflare word?', /cloudflare/i.test(text))
console.log('--- body sample ---\n', text.slice(0, 1200))

const input = page.locator(
  'input[name="trackingNumber"], input#trackingNumber, input[placeholder*="Container" i], input[type="search"], input[type="text"]',
).first()
if (await input.count()) {
  console.log('--- filling input')
  await input.fill(container)
  await page.keyboard.press('Enter')
  const btn = page.locator('button:has-text("Track"), button:has-text("Search"), button[type="submit"]').first()
  if (await btn.count()) await btn.click().catch(() => undefined)
  await page.waitForTimeout(5000)
  text = await page.locator('body').innerText()
  console.log('--- after submit sample ---\n', text.slice(0, 1500))
}

console.log('--- network hits', responses.length)
for (const r of responses.slice(0, 15)) {
  console.log(r.status, r.url)
  console.log(r.preview.replace(/\s+/g, ' ').slice(0, 220))
  console.log('---')
}

await browser.close()
