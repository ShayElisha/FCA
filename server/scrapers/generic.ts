import type { Page } from 'playwright'
import type { Carrier } from '../carriers.js'
import {
  detectIsraelPort,
  extractEtaRaw,
  extractStatus,
  extractVessel,
  pageLooksBlocked,
  pageLooksNotFound,
  parseLooseDate,
} from '../parse.js'
import type { CarrierScrapeOutcome } from '../types.js'

const INPUT_SELECTORS = [
  'input[name*="container" i]',
  'input[id*="container" i]',
  'input[placeholder*="container" i]',
  'input[aria-label*="container" i]',
  'input[name*="tracking" i]',
  'input[type="search"]',
  'input[type="text"]',
]

const SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'button:has-text("Track")',
  'button:has-text("Search")',
  'button:has-text("Find")',
  'input[type="submit"]',
  '[role="button"]:has-text("Track")',
]

export async function scrapeCarrierPage(
  page: Page,
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  try {
    await page.goto(carrier.trackingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    })
    await page.waitForTimeout(1200)

    const bodyEarly = await page.locator('body').innerText().catch(() => '')
    if (pageLooksBlocked(bodyEarly)) {
      return { status: 'blocked', details: 'Blocked on landing page' }
    }

    const filled = await fillContainerInput(page, containerNumber)
    if (!filled) {
      return {
        status: 'error',
        details: 'Could not locate container input on tracking page',
      }
    }

    await submitSearch(page)
    await page.waitForTimeout(2500)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)

    const text = await page.locator('body').innerText()

    if (pageLooksBlocked(text)) {
      return { status: 'blocked', details: 'Blocked after submit' }
    }
    if (pageLooksNotFound(text) || !text.toUpperCase().includes(containerNumber.slice(0, 4))) {
      // Some sites hide the number; still try parse if ETA-like content exists
      const etaProbe = extractEtaRaw(text)
      if (!etaProbe && pageLooksNotFound(text)) {
        return { status: 'not_found' }
      }
      if (!etaProbe && !/\beta\b|arrival|vessel|voyage|port/i.test(text)) {
        return { status: 'not_found' }
      }
    }

    const etaRaw = extractEtaRaw(text)
    const ports = detectIsraelPort(text)
    const vessel = extractVessel(text)
    const status = extractStatus(text)

    if (!etaRaw && status === 'Unknown' && ports.israelPort === 'Unknown') {
      return { status: 'not_found' }
    }

    return {
      status: 'found',
      data: {
        containerNumber,
        carrierId: carrier.id,
        carrierName: carrier.name,
        status,
        destinationPort: ports.destinationPort,
        israelPort: ports.israelPort,
        eta: parseLooseDate(etaRaw),
        etaRaw,
        vesselName: vessel,
        retrievedAt: new Date().toISOString(),
        source: 'scrape',
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/timeout/i.test(message)) {
      return { status: 'error', details: 'Timeout while scraping' }
    }
    return { status: 'error', details: message }
  }
}

async function fillContainerInput(page: Page, containerNumber: string): Promise<boolean> {
  for (const selector of INPUT_SELECTORS) {
    const locator = page.locator(selector).first()
    if ((await locator.count()) === 0) continue
    if (!(await locator.isVisible().catch(() => false))) continue
    await locator.click({ timeout: 2000 }).catch(() => undefined)
    await locator.fill('')
    await locator.fill(containerNumber)
    return true
  }
  return false
}

async function submitSearch(page: Page): Promise<void> {
  for (const selector of SUBMIT_SELECTORS) {
    const locator = page.locator(selector).first()
    if ((await locator.count()) === 0) continue
    if (!(await locator.isVisible().catch(() => false))) continue
    await locator.click({ timeout: 3000 })
    return
  }
  await page.keyboard.press('Enter')
}
