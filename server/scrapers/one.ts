import type { Page } from 'playwright-core'
import type { Carrier } from '../carriers.js'
import { detectIsraelPort, parseLooseDate } from '../parse.js'
import type { CarrierScrapeOutcome } from '../types.js'
import {
  randomDelay,
  humanLikeMouseMove,
  findAndFillInput,
  findAndClickSubmit,
  dismissCookieBanners,
  detectBlocking,
  waitForContent,
} from './improved-helpers.js'

/**
 * ONE (Ocean Network Express) specialized scraper
 */
export async function scrapeOne(
  page: Page,
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  try {
    const url = 'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking'

    await randomDelay(200, 400)
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    await randomDelay(1500, 2000)
    await humanLikeMouseMove(page)
    await dismissCookieBanners(page)

    await randomDelay(1000, 1500)
    
    // Check for initial blocking
    let text = await page.locator('body').innerText().catch(() => '')
    const initialBlock = detectBlocking(text)
    if (initialBlock.blocked) {
      return {
        status: 'blocked',
        details: `ONE blocked: ${initialBlock.reason}`,
      }
    }

    // Fill the container number with improved helper
    const filled = await findAndFillInput(page, containerNumber, {
      inputType: 'container',
      timeoutMs: 5000,
    })
    
    if (!filled) {
      return {
        status: 'error',
        details: 'Could not locate container input on ONE tracking page',
      }
    }

    await randomDelay(600, 900)
    await humanLikeMouseMove(page)
    
    // Click submit with improved helper
    await findAndClickSubmit(page)
    
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined)
    await randomDelay(1500, 2000)

    // Wait for results with smart detection
    const result = await waitForContent(page, {
      successPatterns: [/eta|vessel|voyage|port of|discharged|loaded|in transit|destination/i],
      failurePatterns: [/no results|not found|invalid|no data|no record/i],
      timeoutMs: 15000,
    })

    if (!result.success && result.reason && result.reason !== 'Not found') {
      return {
        status: 'blocked',
        details: `ONE blocked: ${result.reason}`,
      }
    }

    if (!result.success && result.reason === 'Not found') {
      return { status: 'not_found' }
    }

    text = result.text

    return parseOnePage(carrier, containerNumber, text)
  } catch (error) {
    return {
      status: 'error',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

// Old helper functions removed - now using improved-helpers.ts

function parseOnePage(
  carrier: Carrier,
  containerNumber: string,
  text: string,
): CarrierScrapeOutcome {
  const ports = detectIsraelPort(text)
  
  const etaMatch = text.match(
    /(?:ETA|Estimated\s+Arrival|Arrival)[:\s]+([A-Za-z0-9,/\-\s:]{5,40})/i,
  )
  const etaRaw = etaMatch?.[1]?.trim()
  
  const statusMatch = text.match(
    /(?:Status)[:\s]+([^\n]{3,80})/i,
  ) || text.match(
    /\b(In Transit|Discharged|Gate Out|Gate In|Arrived|Loaded|Empty|Delivered|On Board|Departed)\b/i,
  )
  
  const vesselMatch = text.match(
    /(?:Vessel|Ship)[:\s]+([A-Za-z0-9 \-]{3,60})/i,
  )
  
  const destMatch = text.match(
    /(?:Destination|POD|Port of Discharge|Discharge)[:\s]+([^\n]{3,80})/i,
  )
  
  const originMatch = text.match(
    /(?:Origin|POL|Port of Loading)[:\s]+([^\n]{3,80})/i,
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
      retrievedAt: new Date().toISOString(),
      source: 'scrape',
    },
  }
}
