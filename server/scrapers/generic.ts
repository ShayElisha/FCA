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
  // Container-specific
  'input[name*="container" i]',
  'input[id*="container" i]',
  'input[placeholder*="container" i]',
  'input[aria-label*="container" i]',
  'input[class*="container" i]',
  'input[data-test*="container" i]',
  
  // Tracking-specific
  'input[name*="tracking" i]',
  'input[id*="tracking" i]',
  'input[placeholder*="tracking" i]',
  'input[aria-label*="tracking" i]',
  'input[name="trackingNumber"]',
  'input[id="trackingNumber"]',
  'input[name="track"]',
  'input[id="track"]',
  
  // Shipment/cargo
  'input[name*="shipment" i]',
  'input[id*="shipment" i]',
  'input[placeholder*="shipment" i]',
  'input[name*="cargo" i]',
  'input[id*="cargo" i]',
  
  // Reference/BL
  'input[name*="reference" i]',
  'input[id*="reference" i]',
  'input[placeholder*="reference" i]',
  'input[name*="bill" i]',
  'input[name*="bl" i]',
  
  // Number fields
  'input[placeholder*="number" i]',
  'input[aria-label*="number" i]',
  
  // Framework-specific
  'input.ant-input',
  'input[class*="MuiInput"]',
  'input[class*="form-control"]',
  'input[class*="input"]',
  
  // Generic
  'input[type="search"]',
  'input[type="text"]',
  'input:not([type])',
]

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

async function dismissCookieBanners(page: Page): Promise<void> {
  await randomDelay(500, 1000)
  await humanLikeMouseMove(page)
  
  for (const label of [
    'Allow All',
    'Accept All',
    'Accept all',
    'Accept',
    'Agree',
    'I agree',
    'Got it',
    'Confirm',
    'OK',
    'I Accept',
    'Continue',
  ]) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await randomDelay(200, 500)
      await btn.click({ timeout: 1500 }).catch(() => undefined)
      await randomDelay(300, 700)
      break
    }
  }
}

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

    await randomDelay(100, 300)
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    })

    await randomDelay(usedDirect ? 800 : 1200, usedDirect ? 1500 : 2000)
    await humanLikeMouseMove(page)
    await dismissCookieBanners(page)

    const bodyEarly = await page.locator('body').innerText().catch(() => '')
    if (pageLooksBlocked(bodyEarly)) {
      return { status: 'blocked', details: 'Blocked on landing page' }
    }

    // Direct URL may already show results
    if (usedDirect && looksLikeResult(bodyEarly, containerNumber)) {
      await randomDelay(500, 1000)
      return buildFound(carrier, containerNumber, bodyEarly)
    }

    await randomDelay(300, 600)
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

    await randomDelay(500, 1000)
    await humanLikeMouseMove(page)
    await submitSearch(page)
    
    await page
      .waitForLoadState('domcontentloaded', { timeout: 10000 })
      .catch(() => undefined)
    await randomDelay(1000, 1500)

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
    
    await locator.click({ timeout: 1500 }).catch(() => undefined)
    await randomDelay(100, 300)
    
    await locator.clear().catch(() => undefined)
    await randomDelay(50, 150)
    
    for (const char of containerNumber) {
      await locator.type(char, { delay: Math.floor(Math.random() * 100) + 50 })
    }
    
    await randomDelay(200, 400)
    return true
  }
  return false
}

async function submitSearch(page: Page): Promise<void> {
  await randomDelay(300, 600)
  
  for (const selector of SUBMIT_SELECTORS) {
    const locator = page.locator(selector).first()
    if ((await locator.count().catch(() => 0)) === 0) continue
    if (!(await locator.isVisible().catch(() => false))) continue
    
    await humanLikeMouseMove(page)
    await randomDelay(100, 300)
    await locator.click({ timeout: 2000 })
    return
  }
  
  await randomDelay(100, 200)
  await page.keyboard.press('Enter')
}
