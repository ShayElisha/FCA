import type { Page } from 'playwright-core'
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
import { scrapeCarrierPage } from './generic.js'

/**
 * MSC-oriented scraper: tries MSC-specific fields first, then falls back to generic.
 * Uses browser automation only — no carrier API.
 */
export async function scrapeMsc(
  page: Page,
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  try {
    await page.goto(carrier.trackingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    })
    await page.waitForTimeout(1500)

    const early = await page.locator('body').innerText().catch(() => '')
    if (pageLooksBlocked(early)) {
      return { status: 'blocked', details: 'MSC landing blocked' }
    }

    const candidates = [
      'input[name="trackingNumber"]',
      'input#trackingNumber',
      'input[placeholder*="Container" i]',
      'input[data-testid*="track" i]',
    ]

    let filled = false
    for (const selector of candidates) {
      const input = page.locator(selector).first()
      if ((await input.count()) === 0) continue
      if (!(await input.isVisible().catch(() => false))) continue
      await input.fill(containerNumber)
      filled = true
      break
    }

    if (!filled) {
      return scrapeCarrierPage(page, carrier, containerNumber)
    }

    const searchBtn = page
      .locator(
        'button:has-text("Track"), button:has-text("Search"), button[type="submit"]',
      )
      .first()
    if (await searchBtn.count()) {
      await searchBtn.click()
    } else {
      await page.keyboard.press('Enter')
    }

    await page.waitForTimeout(3000)
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined)

    const text = await page.locator('body').innerText()
    if (pageLooksBlocked(text)) return { status: 'blocked', details: 'MSC blocked' }
    if (pageLooksNotFound(text)) return { status: 'not_found' }

    const etaRaw = extractEtaRaw(text)
    const ports = detectIsraelPort(text)

    return {
      status: 'found',
      data: {
        containerNumber,
        carrierId: carrier.id,
        carrierName: carrier.name,
        status: extractStatus(text),
        destinationPort: ports.destinationPort,
        israelPort: ports.israelPort,
        eta: parseLooseDate(etaRaw),
        etaRaw,
        vesselName: extractVessel(text),
        retrievedAt: new Date().toISOString(),
        source: 'scrape',
      },
    }
  } catch (error) {
    return {
      status: 'error',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}
