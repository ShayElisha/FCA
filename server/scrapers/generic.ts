import type { Page } from 'playwright-core'
import { resolveTrackUrl, type Carrier } from '../carriers.js'
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
  'input[name="trackingNumber"]',
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
    const url = resolveTrackUrl(carrier, containerNumber)
    const usedDirect = url !== carrier.trackingUrl

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 12000,
    })

    // Brief settle only — avoid long fixed sleeps / networkidle
    await page.waitForTimeout(usedDirect ? 400 : 600)

    const bodyEarly = await page.locator('body').innerText().catch(() => '')
    if (pageLooksBlocked(bodyEarly)) {
      return { status: 'blocked', details: 'Blocked on landing page' }
    }

    // Direct URL may already show results
    if (usedDirect && looksLikeResult(bodyEarly, containerNumber)) {
      return buildFound(carrier, containerNumber, bodyEarly)
    }

    const filled = await fillContainerInput(page, containerNumber)
    if (!filled) {
      if (looksLikeResult(bodyEarly, containerNumber)) {
        return buildFound(carrier, containerNumber, bodyEarly)
      }
      return {
        status: 'error',
        details: 'Could not locate container input on tracking page',
      }
    }

    await submitSearch(page)
    await page
      .waitForLoadState('domcontentloaded', { timeout: 8000 })
      .catch(() => undefined)
    await page.waitForTimeout(700)

    const text = await page.locator('body').innerText()

    if (pageLooksBlocked(text)) {
      return { status: 'blocked', details: 'Blocked after submit' }
    }
    if (pageLooksNotFound(text)) {
      return { status: 'not_found' }
    }
    if (!looksLikeResult(text, containerNumber)) {
      return { status: 'not_found' }
    }

    return buildFound(carrier, containerNumber, text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/timeout/i.test(message)) {
      return { status: 'error', details: 'Timeout while scraping' }
    }
    return { status: 'error', details: message }
  }
}

function looksLikeResult(text: string, containerNumber: string): boolean {
  const etaProbe = extractEtaRaw(text)
  if (etaProbe) return true
  if (pageLooksNotFound(text)) return false
  const hasNumber = text.toUpperCase().includes(containerNumber.slice(0, 4))
  const hasTrackingWords = /\beta\b|arrival|vessel|voyage|port|in transit|discharged/i.test(
    text,
  )
  return hasNumber && hasTrackingWords
}

function buildFound(
  carrier: Carrier,
  containerNumber: string,
  text: string,
): CarrierScrapeOutcome {
  const etaRaw = extractEtaRaw(text)
  const ports = detectIsraelPort(text)
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
      vesselName: extractVessel(text),
      retrievedAt: new Date().toISOString(),
      source: 'scrape',
    },
  }
}

async function fillContainerInput(
  page: Page,
  containerNumber: string,
): Promise<boolean> {
  for (const selector of INPUT_SELECTORS) {
    const locator = page.locator(selector).first()
    if ((await locator.count().catch(() => 0)) === 0) continue
    if (!(await locator.isVisible().catch(() => false))) continue
    await locator.fill(containerNumber, { timeout: 1500 }).catch(() => undefined)
    return true
  }
  return false
}

async function submitSearch(page: Page): Promise<void> {
  for (const selector of SUBMIT_SELECTORS) {
    const locator = page.locator(selector).first()
    if ((await locator.count().catch(() => 0)) === 0) continue
    if (!(await locator.isVisible().catch(() => false))) continue
    await locator.click({ timeout: 2000 })
    return
  }
  await page.keyboard.press('Enter')
}
