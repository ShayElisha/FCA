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
 * COSCO eLines tracker lives in /scct (Ant Design SPA).
 * Deep-link with trackingType=container&number=… — no carrier API client.
 */
export async function scrapeCosco(
  page: Page,
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  try {
    const url =
      `https://elines.coscoshipping.com/scct/public/ct/base` +
      `?lang=en&trackingType=container&number=${encodeURIComponent(containerNumber)}`

    await randomDelay(200, 400)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    
    await randomDelay(1000, 1500)
    await humanLikeMouseMove(page)
    await dismissCoscoNoise(page)
    
    await page
      .waitForSelector('input.ant-input, .ant-input', { timeout: 15000 })
      .catch(() => undefined)

    await randomDelay(500, 800)
    
    // Ensure number is in the field (deep-link usually prefills)
    const input = page.locator('input.ant-input').first()
    if (await input.count()) {
      const current = await input.inputValue().catch(() => '')
      if (current.toUpperCase() !== containerNumber) {
        await input.click().catch(() => undefined)
        await randomDelay(200, 400)
        await input.clear().catch(() => undefined)
        await randomDelay(100, 200)
        
        for (const char of containerNumber) {
          await input.type(char, { delay: Math.floor(Math.random() * 100) + 50 })
        }
        
        await randomDelay(500, 800)
        await humanLikeMouseMove(page)
        
        await page.getByRole('button', { name: /search/i }).first().click().catch(async () => {
          await page.keyboard.press('Enter')
        })
      }
    }

    await randomDelay(1500, 2000)
    const deadline = Date.now() + 15000
    let text = ''
    while (Date.now() < deadline) {
      text = await page.locator('body').innerText().catch(() => '')
      if (
        /no results found|not found|please check the number/i.test(text) ||
        /eta|vessel|voyage|port of|discharged|gate|loaded|in transit|destination/i.test(
          text,
        )
      ) {
        break
      }
      await randomDelay(500, 700)
    }

    if (/access denied|verify you are human|just a moment|cloudflare|captcha/i.test(text)) {
      return {
        status: 'blocked',
        details: 'COSCO blocked automated browser on eLines page',
      }
    }

    if (
      /no results found|please check the number you entered|not found/i.test(
        text,
      )
    ) {
      return { status: 'not_found' }
    }

    return parseCoscoPage(carrier, containerNumber, text)
  } catch (error) {
    return {
      status: 'error',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

async function dismissCoscoNoise(page: Page): Promise<void> {
  await randomDelay(300, 600)
  
  for (const label of ['Allow All', 'Accept All', 'Accept', 'Confirm', 'OK', 'I Accept', 'Continue']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
    if (await btn.isVisible().catch(() => false)) {
      await humanLikeMouseMove(page)
      await randomDelay(200, 400)
      await btn.click().catch(() => undefined)
      await randomDelay(600, 900)
      break
    }
  }
}

function parseCoscoPage(
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
    /\b(In Transit|Discharged|Gate Out|Gate In|Arrived|Loaded|Empty|Customs Hold|Delivered)\b/i,
  )
  const vesselMatch = text.match(
    /(?:Vessel|Vessel Name)[:\s]+([A-Za-z0-9 \-]{3,60})/i,
  )
  const destMatch = text.match(
    /(?:Place of Delivery|Port of Discharge|Destination)[:\s]+([^\n]{3,80})/i,
  )
  const originMatch = text.match(
    /(?:Place of Receipt|Port of Loading|Origin)[:\s]+([^\n]{3,80})/i,
  )

  const hasTrackingSignal =
    Boolean(etaRaw) ||
    Boolean(statusMatch) ||
    /vessel|voyage|container no|shipment/i.test(text)

  if (!hasTrackingSignal) {
    return { status: 'not_found' }
  }

  return {
    status: 'found',
    data: {
      containerNumber,
      carrierId: carrier.id,
      carrierName: carrier.name,
      status: statusMatch?.[1] || 'Unknown',
      originPort: originMatch?.[1]?.trim(),
      destinationPort:
        destMatch?.[1]?.trim() || ports.destinationPort,
      israelPort: ports.israelPort,
      eta: parseLooseDate(etaRaw),
      etaRaw,
      vesselName: vesselMatch?.[1]?.trim(),
      retrievedAt: new Date().toISOString(),
      source: 'scrape',
    },
  }
}
