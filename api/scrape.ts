import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { CarrierId } from '../server/carriers.js'
import { CARRIERS } from '../server/carriers.js'
import {
  isValidContainer,
  normalizeContainer,
  scrapeOneCarrier,
} from '../server/handlers/scrapeOne.js'

export const config = {
  maxDuration: 60,
  memory: 1024,
}

/**
 * Vercel Serverless: scrape a single carrier tracking page with Playwright.
 * Frontend orchestrates multi-carrier search by calling this per carrier.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' },
    })
    return
  }

  const containerNumber = normalizeContainer(req.body?.containerNumber)
  const carrierId = String(req.body?.carrierId ?? '') as CarrierId

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

    if (outcome.status === 'blocked') {
      res.status(200).json({
        ok: true,
        status: 'blocked',
        details: outcome.details,
      })
      return
    }

    if (outcome.status === 'error') {
      res.status(200).json({
        ok: true,
        status: 'error',
        details: outcome.details,
      })
      return
    }

    res.status(200).json({ ok: true, status: 'not_found' })
  } catch (error) {
    console.error('scrape failed', error)
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'אירעה תקלה בסריקת האתר. נסו שוב.',
        details: error instanceof Error ? error.message : String(error),
      },
    })
  }
}
