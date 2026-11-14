import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CARRIERS, type CarrierId } from '../server/carriers.js'
import {
  isValidContainer,
  normalizeContainer,
  scrapeOneCarrier,
} from '../server/handlers/scrapeOne.js'
import { searchAcrossCarriers } from '../server/search.js'

export const config = {
  maxDuration: 60,
}

/**
 * POST /api/track
 * - { containerNumber, carrierId } → scrape one carrier (serverless-friendly)
 * - { containerNumber } → multi-carrier search (prefix first; may hit timeout on fan-out)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    res.status(405).json({
      ok: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'יש לשלוח POST אל /api/track עם JSON: { containerNumber, carrierId? }',
      },
    })
    return
  }

  // Preferred production path: forward to a Chrome scraper host (Docker/VPS).
  // Avoids Akamai blocking of Vercel serverless Chromium — no bot-bypass tricks.
  const upstream = process.env.SCRAPER_UPSTREAM_URL?.replace(/\/$/, '')
  if (upstream) {
    try {
      const proxied = await fetch(`${upstream}/api/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body ?? {}),
      })
      const text = await proxied.text()
      res.status(proxied.status)
      const ct = proxied.headers.get('content-type') || 'application/json'
      res.setHeader('Content-Type', ct)
      res.send(text)
      return
    } catch (error) {
      res.status(502).json({
        ok: false,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message:
            'שרת הסריקה עם Chrome לא זמין. בדקו את SCRAPER_UPSTREAM_URL.',
          details: error instanceof Error ? error.message : String(error),
        },
      })
      return
    }
  }

  const containerNumber = normalizeContainer(req.body?.containerNumber)
  const carrierIdRaw = req.body?.carrierId
    ? String(req.body.carrierId)
    : undefined

  if (!isValidContainer(containerNumber)) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_CONTAINER_NUMBER',
        message:
          'מספר המכולה אינו תקין לפי תקן ISO 6346. הפורמט הנדרש: 4 אותיות ו-7 ספרות.',
      },
    })
    return
  }

  // Single-carrier mode (used by the UI fan-out)
  if (carrierIdRaw) {
    const carrierId = carrierIdRaw as CarrierId
    if (!CARRIERS.some((c) => c.id === carrierId)) {
      res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_CARRIER',
          message: 'חברת ספנות לא נתמכת.',
        },
      })
      return
    }

    try {
      const outcome = await scrapeOneCarrier(containerNumber, carrierId)
      if (outcome.status === 'found') {
        res.status(200).json({ ok: true, status: 'found', data: outcome.data })
        return
      }
      res.status(200).json({
        ok: true,
        status: outcome.status,
        details: 'details' in outcome ? outcome.details : undefined,
      })
      return
    } catch (error) {
      console.error('track/scrape failed', error)
      res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'אירעה תקלה בסריקת האתר. נסו שוב.',
          details: error instanceof Error ? error.message : String(error),
        },
      })
      return
    }
  }

  // Multi-carrier mode — stream SSE progress + final result
  const wantsStream =
    String(req.headers.accept ?? '').includes('text/event-stream') ||
    req.query.stream === '1'

  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.status(200)

    const send = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`)
    }

    try {
      for await (const event of searchAcrossCarriers(containerNumber)) {
        send(event)
        if (event.type === 'result') break
      }
    } catch (error) {
      console.error('track stream failed', error)
      send({
        type: 'result',
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'אירעה תקלה בסריקת האתרים. נסו שוב.',
          details: error instanceof Error ? error.message : String(error),
        },
      })
    } finally {
      res.end()
    }
    return
  }

  // JSON multi-carrier (no stream)
  try {
    let finalResult: unknown = null
    for await (const event of searchAcrossCarriers(containerNumber)) {
      if (event.type === 'result') {
        finalResult = event
        break
      }
    }
    res.status(200).json(finalResult ?? {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'הסריקה הסתיימה ללא תוצאה.',
      },
    })
  } catch (error) {
    console.error('track failed', error)
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'אירעה תקלה בסריקת האתרים. נסו שוב.',
        details: error instanceof Error ? error.message : String(error),
      },
    })
  }
}
