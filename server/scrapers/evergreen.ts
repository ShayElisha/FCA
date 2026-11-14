import type { Page } from 'playwright-core'
import type { Carrier } from '../carriers.js'
import { detectIsraelPort, parseLooseDate } from '../parse.js'
import type { CarrierScrapeOutcome } from '../types.js'

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, delay))
}

async function humanLikeMouseMove(page: Page): Promise<void> {
  const x = Math.floor(Math.random() * 500) + 100
  const y = Math.floor(Math.random() * 300) + 100
  await page.mouse.move(x, y).catch(() => undefined)
  await randomDelay(50, 150)
}

/**
 * Evergreen specialized scraper
 */
export async function scrapeEvergreen(
  page: Page,
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  try {
    const url = 'https://www.evergreen-line.com/emodal/eModul_Show.do?flag_type=2'

    await randomDelay(200, 400)
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    await randomDelay(1500, 2000)
    await humanLikeMouseMove(page)
    await dismissCookies(page)

    await randomDelay(1000, 1500)
    
    let text = await page.locator('body').innerText().catch(() => '')
    if (/access denied|cloudflare|captcha|verify you are human/i.test(text)) {
      return {
        status: 'blocked',
        details: 'Evergreen blocked automated browser',
      }
    }

    // Fill the container number
    const filled = await fillInput(page, containerNumber)
    if (!filled) {
      return {
        status: 'error',
        details: 'Could not locate container input on Evergreen tracking page',
      }
    }

    await randomDelay(600, 900)
    await humanLikeMouseMove(page)
    await submitSearch(page)
    
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined)
    await randomDelay(1500, 2000)

    // Wait for results
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      text = await page.locator('body').innerText().catch(() => '')
      if (
        /no results|not found|invalid|no data|no record|查無資料/i.test(text) ||
        /eta|estimated arrival|vessel|voyage|port of|discharged|loaded|in transit|destination/i.test(text)
      ) {
        break
      }
      await randomDelay(600, 900)
    }

    if (/access denied|cloudflare|captcha/i.test(text)) {
      return {
        status: 'blocked',
        details: 'Evergreen blocked after submit',
      }
    }

    if (/no results|not found|invalid|no data|no record|查無資料/i.test(text)) {
      return { status: 'not_found' }
    }

    return parseEvergreenPage(carrier, containerNumber, text)
  } catch (error) {
    return {
      status: 'error',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

async function dismissCookies(page: Page): Promise<void> {
  await randomDelay(400, 700)
  
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("OK")',
    'button:has-text("I accept")',
    'button:has-text("Agree")',
    'button:has-text("同意")',
    '.cookie-accept',
  ]
  
  for (const selector of selectors) {
    const btn = page.locator(selector).first()
    if (await btn.isVisible().catch(() => false)) {
      await humanLikeMouseMove(page)
      await randomDelay(200, 400)
      await btn.click({ timeout: 1500 }).catch(() => undefined)
      await randomDelay(600, 900)
      break
    }
  }
}

async function fillInput(page: Page, containerNumber: string): Promise<boolean> {
  const selectors = [
    'input[name*="container" i]',
    'input[id*="container" i]',
    'input[placeholder*="container" i]',
    'input[name*="bl" i]',
    'input[id*="bl" i]',
    'input[name*="number" i]',
    'input[id="number"]',
    'input[type="text"]',
    'textarea[name*="number" i]',
  ]
  
  for (const selector of selectors) {
    const locator = page.locator(selector).first()
    if ((await locator.count().catch(() => 0)) === 0) continue
    if (!(await locator.isVisible().catch(() => false))) continue
    
    await locator.click({ timeout: 1500 }).catch(() => undefined)
    await randomDelay(150, 300)
    
    await locator.clear().catch(() => undefined)
    await randomDelay(100, 200)
    
    for (const char of containerNumber) {
      await locator.type(char, { delay: Math.floor(Math.random() * 100) + 50 })
    }
    
    await randomDelay(300, 500)
    return true
  }
  return false
}

async function submitSearch(page: Page): Promise<void> {
  await randomDelay(400, 700)
  
  const selectors = [
    'button[type="submit"]',
    'button:has-text("Track")',
    'button:has-text("Search")',
    'button:has-text("Query")',
    'button:has-text("查詢")',
    'input[type="submit"]',
    'input[type="button"][value*="Search" i]',
    'input[type="button"][value*="Query" i]',
  ]
  
  for (const selector of selectors) {
    const locator = page.locator(selector).first()
    if ((await locator.count().catch(() => 0)) === 0) continue
    if (!(await locator.isVisible().catch(() => false))) continue
    
    await humanLikeMouseMove(page)
    await randomDelay(150, 300)
    await locator.click({ timeout: 2000 }).catch(() => undefined)
    return
  }
  
  await randomDelay(100, 200)
  await page.keyboard.press('Enter')
}

function parseEvergreenPage(
  carrier: Carrier,
  containerNumber: string,
  text: string,
): CarrierScrapeOutcome {
  const ports = detectIsraelPort(text)
  
  const etaMatch = text.match(
    /(?:ETA|Estimated\s+Arrival|Arrival|到港日期)[:\s]+([A-Za-z0-9,/\-\s:]{5,40})/i,
  )
  const etaRaw = etaMatch?.[1]?.trim()
  
  const statusMatch = text.match(
    /(?:Status|狀態)[:\s]+([^\n]{3,80})/i,
  ) || text.match(
    /\b(In Transit|Discharged|Gate Out|Gate In|Arrived|Loaded|Empty|Delivered|On Board|Departed)\b/i,
  )
  
  const vesselMatch = text.match(
    /(?:Vessel|Ship|船名)[:\s]+([A-Za-z0-9 \-]{3,60})/i,
  )
  
  const destMatch = text.match(
    /(?:Destination|POD|Port of Discharge|Discharge|卸貨港)[:\s]+([^\n]{3,80})/i,
  )
  
  const originMatch = text.match(
    /(?:Origin|POL|Port of Loading|裝貨港)[:\s]+([^\n]{3,80})/i,
  )

  const hasTrackingSignal =
    Boolean(etaRaw) ||
    Boolean(statusMatch) ||
    /vessel|voyage|container|shipment|tracking|船|航|櫃/i.test(text)

  if (!hasTrackingSignal) {
    return { status: 'not_found' }
  }

  return {
    status: 'found',
    data: {
      containerNumber,
      carrierId: carrier.id,
      carrierName: carrier.name,
      status: statusMatch?.[1]?.trim() || 'Unknown',
      originPort: originMatch?.[1]?.trim(),
      destinationPort: destMatch?.[1]?.trim() || ports.destinationPort,
      israelPort: ports.israelPort,
      eta: parseLooseDate(etaRaw),
      etaRaw,
      vesselName: vesselMatch?.[1]?.trim(),
      retrievedAt: new Date().toISOString(),
      source: 'scrape',
    },
  }
}
