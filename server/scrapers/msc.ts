import type { Page } from 'playwright-core'
import type { Carrier } from '../carriers.js'
import { detectIsraelPort, parseLooseDate } from '../parse.js'
import type { CarrierScrapeOutcome } from '../types.js'

type MscEvent = {
  Order?: number
  Date?: string
  Location?: string
  Description?: string
  Detail?: string[]
  Vessel?: { Name?: string }
}

type MscTrackingResponse = {
  IsSuccess?: boolean
  Data?: {
    TrackingNumber?: string
    BillOfLadings?: Array<{
      BillOfLadingNumber?: string
      GeneralTrackingInfo?: {
        ShippedFrom?: string
        ShippedTo?: string
        PortOfLoad?: string
        PortOfDischarge?: string
        FinalPodEtaDate?: string
      }
      ContainersInfo?: Array<{ Events?: MscEvent[] }>
    }>
  }
}

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
 * MSC public track page posts to /api/feature/tools/TrackingInfo.
 * We open the site's params URL and capture that JSON response.
 * Bundled Chromium is often blocked by Akamai — prefer real Chrome locally.
 */
export async function scrapeMsc(
  page: Page,
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  try {
    const params = Buffer.from(
      `trackingNumber=${containerNumber}&trackingMode=0`,
    ).toString('base64')
    const url = `https://www.msc.com/en/track-a-shipment?params=${encodeURIComponent(params)}`

    let trackingJson: MscTrackingResponse | null = null

    const onResponse = async (res: {
      url: () => string
      status: () => number
      text: () => Promise<string>
    }) => {
      if (!res.url().includes('/api/feature/tools/TrackingInfo')) return
      if (res.status() >= 400) return
      try {
        trackingJson = JSON.parse(await res.text()) as MscTrackingResponse
      } catch {
        // ignore
      }
    }

    page.on('response', onResponse)

    await randomDelay(200, 400)
    const nav = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    await randomDelay(800, 1200)
    await humanLikeMouseMove(page)

    const early = await page.locator('body').innerText().catch(() => '')
    if (
      nav?.status() === 403 ||
      /access denied|you don't have permission|cloudflare|captcha/i.test(early)
    ) {
      page.off('response', onResponse)
      return {
        status: 'blocked',
        details:
          'MSC/Akamai blocked automated browser. Run locally with Chrome installed.',
      }
    }

    const deadline = Date.now() + 15000
    while (!trackingJson && Date.now() < deadline) {
      await randomDelay(400, 600)
    }
    page.off('response', onResponse)

    if (!trackingJson) {
      await randomDelay(500, 800)
      const api = await page.request.post(
        'https://www.msc.com/api/feature/tools/TrackingInfo',
        {
          data: { trackingNumber: containerNumber, trackingMode: '0' },
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://www.msc.com',
            'Referer': 'https://www.msc.com/en/track-a-shipment',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
          },
          timeout: 15000,
        },
      )
      const text = await api.text()
      if (api.status() >= 400 || /access denied|cloudflare|captcha/i.test(text)) {
        return {
          status: 'blocked',
          details: `MSC TrackingInfo HTTP ${api.status()}`,
        }
      }
      try {
        trackingJson = JSON.parse(text) as MscTrackingResponse
      } catch {
        return {
          status: 'error',
          details: 'MSC returned non-JSON tracking payload',
        }
      }
    }

    return parseMscTracking(carrier, containerNumber, trackingJson)
  } catch (error) {
    return {
      status: 'error',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

export function parseMscTracking(
  carrier: Carrier,
  containerNumber: string,
  json: MscTrackingResponse,
): CarrierScrapeOutcome {
  if (!json.IsSuccess || !json.Data) {
    return { status: 'not_found' }
  }

  const bol = json.Data.BillOfLadings?.[0]
  const info = bol?.GeneralTrackingInfo
  const events = bol?.ContainersInfo?.[0]?.Events ?? []
  const latest = [...events].sort((a, b) => (b.Order ?? 0) - (a.Order ?? 0))[0]

  const destination =
    info?.ShippedTo || info?.PortOfDischarge || latest?.Location || ''
  const origin = info?.ShippedFrom || info?.PortOfLoad
  const ports = detectIsraelPort(
    `${destination} ${info?.PortOfDischarge ?? ''} ${info?.ShippedTo ?? ''}`,
  )

  const etaRaw =
    (info?.FinalPodEtaDate && info.FinalPodEtaDate.trim()) ||
    events.find((e) =>
      /discharged from vessel|pod|arrival/i.test(e.Description ?? ''),
    )?.Date ||
    latest?.Date

  const vesselName =
    latest?.Detail?.find((d) => /^MSC\b/i.test(d) || /\b[A-Z]{2}\d{3}/.test(d)) ||
    latest?.Vessel?.Name

  return {
    status: 'found',
    data: {
      containerNumber: json.Data.TrackingNumber || containerNumber,
      carrierId: carrier.id,
      carrierName: carrier.name,
      status: latest?.Description || 'Unknown',
      currentLocation: latest?.Location,
      originPort: origin,
      destinationPort: destination || ports.destinationPort,
      israelPort: ports.israelPort,
      eta: parseLooseDate(etaRaw || undefined),
      etaRaw: etaRaw || undefined,
      vesselName: vesselName || undefined,
      voyageNumber: bol?.BillOfLadingNumber,
      retrievedAt: new Date().toISOString(),
      source: 'scrape',
    },
  }
}
