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
 * CMA CGM specialized scraper with anti-detection
 */
export async function scrapeCma(
  page: Page,
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  try {
    const url = `https://www.cma-cgm.com/ebusiness/tracking/search?SearchType=2&Reference=${containerNumber}`

    await randomDelay(200, 400)
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    await randomDelay(1500, 2000)
    await humanLikeMouseMove(page)

    // Dismiss cookie banners
    await dismissCookies(page)

    await randomDelay(1200, 1800)
    
    // Check for blocking
    let text = await page.locator('body').innerText().catch(() => '')
    if (/access denied|cloudflare|captcha|verify you are human|please verify/i.test(text)) {
      return {
        status: 'blocked',
        details: 'CMA CGM blocked automated browser',
      }
    }

    // CMA CGM often uses dynamic loading
    await page.waitForSelector('.tracking-result, .shipment-data, [class*="tracking"]', { timeout: 10000 }).catch(() => undefined)
    
    await randomDelay(1000, 1500)

    // Wait for results
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      text = await page.locator('body').innerText().catch(() => '')
      if (
        /no results|not found|invalid|no shipment|no container/i.test(text) ||
        /eta|estimated arrival|vessel|voyage|port of|discharged|loaded|in transit|destination/i.test(text)
      ) {
        break
      }
      await randomDelay(600, 900)
    }

    if (/no results|not found|invalid reference|no shipment|no container/i.test(text)) {
      return { status: 'not_found' }
    }

    return parseCmaPage(carrier, containerNumber, text)
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
    '[id*="cookie"][id*="accept"]',
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

function parseCmaPage(
  carrier: Carrier,
  containerNumber: string,
  text: string,
): CarrierScrapeOutcome {
  const ports = detectIsraelPort(text)
  
  const etaMatch = text.match(
    /(?:ETA|Estimated\s+Arrival|Estimated\s+Time|Arrival\s+Date)[:\s]+([A-Za-z0-9,/\-\s:]{5,40})/i,
  )
  const etaRaw = etaMatch?.[1]?.trim()
  
  const statusMatch = text.match(
    /(?:Status|Container\s+Status|Shipment\s+Status)[:\s]+([^\n]{3,80})/i,
  ) || text.match(
    /\b(In Transit|Discharged|Gate Out|Gate In|Arrived|Loaded|Empty|Customs Hold|Delivered|On Board|Departed|Transshipment)\b/i,
  )
  
  const vesselMatch = text.match(
    /(?:Vessel|Vessel Name|Ship Name)[:\s]+([A-Za-z0-9 \-]{3,60})/i,
  )
  
  const destMatch = text.match(
    /(?:Place of Delivery|Port of Discharge|Destination|Discharge\s+Port|POD)[:\s]+([^\n]{3,80})/i,
  )
  
  const originMatch = text.match(
    /(?:Place of Receipt|Port of Loading|Origin|Load\s+Port|POL)[:\s]+([^\n]{3,80})/i,
  )
  
  const voyageMatch = text.match(
    /(?:Voyage|Voyage\s+Number|Voyage\s+No)[:\s\.]+([A-Za-z0-9\-]{3,30})/i,
  )

  const hasTrackingSignal =
    Boolean(etaRaw) ||
    Boolean(statusMatch) ||
    /vessel|voyage|container|shipment|tracking|cma/i.test(text)

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
      voyageNumber: voyageMatch?.[1]?.trim(),
      retrievedAt: new Date().toISOString(),
      source: 'scrape',
    },
  }
}
