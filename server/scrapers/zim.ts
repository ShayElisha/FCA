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
 * ZIM specialized scraper with anti-detection
 */
export async function scrapeZim(
  page: Page,
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  try {
    const url = `https://www.zim.com/tools/track-a-shipment?consNumber=${containerNumber}`

    await randomDelay(200, 400)
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    await randomDelay(1200, 1800)
    await humanLikeMouseMove(page)

    // Dismiss cookie banners
    await dismissCookies(page)

    // Wait for content to load
    await randomDelay(1000, 1500)
    
    // Check for blocking
    let text = await page.locator('body').innerText().catch(() => '')
    if (/access denied|cloudflare|captcha|verify you are human/i.test(text)) {
      return {
        status: 'blocked',
        details: 'ZIM blocked automated browser',
      }
    }

    // Wait for results
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      text = await page.locator('body').innerText().catch(() => '')
      if (
        /no results|not found|invalid/i.test(text) ||
        /eta|vessel|voyage|port|discharged|loaded|departure|arrival/i.test(text)
      ) {
        break
      }
      await randomDelay(500, 800)
    }

    if (/no results|not found|invalid number|could not be found/i.test(text)) {
      return { status: 'not_found' }
    }

    return parseZimPage(carrier, containerNumber, text)
  } catch (error) {
    return {
      status: 'error',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

async function dismissCookies(page: Page): Promise<void> {
  await randomDelay(300, 600)
  
  for (const label of ['Accept', 'Accept All', 'OK', 'I Accept', 'Confirm', 'Continue', 'Got it']) {
    const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await humanLikeMouseMove(page)
      await randomDelay(200, 400)
      await btn.click({ timeout: 1500 }).catch(() => undefined)
      await randomDelay(500, 800)
      break
    }
  }
}

function parseZimPage(
  carrier: Carrier,
  containerNumber: string,
  text: string,
): CarrierScrapeOutcome {
  const ports = detectIsraelPort(text)
  
  const etaMatch = text.match(
    /(?:ETA|Estimated\s+Arrival|Arrival\s+Date)[:\s]+([A-Za-z0-9,/\-\s:]{5,40})/i,
  )
  const etaRaw = etaMatch?.[1]?.trim()
  
  const statusMatch = text.match(
    /(?:Status|Container\s+Status)[:\s]+([^\n]{3,60})/i,
  ) || text.match(
    /\b(In Transit|Discharged|Gate Out|Gate In|Arrived|Loaded|Empty|Delivered|Departed|On Board)\b/i,
  )
  
  const vesselMatch = text.match(
    /(?:Vessel|Vessel Name|Ship)[:\s]+([A-Za-z0-9 \-]{3,60})/i,
  )
  
  const destMatch = text.match(
    /(?:Destination|POD|Port of Discharge|Discharge Port)[:\s]+([^\n]{3,80})/i,
  )
  
  const originMatch = text.match(
    /(?:Origin|POL|Port of Loading|Load Port)[:\s]+([^\n]{3,80})/i,
  )
  
  const voyageMatch = text.match(
    /(?:Voyage|Voyage Number)[:\s]+([A-Za-z0-9\-]{3,30})/i,
  )

  const hasTrackingSignal =
    Boolean(etaRaw) ||
    Boolean(statusMatch) ||
    /vessel|voyage|container|shipment|tracking/i.test(text)

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
