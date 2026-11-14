/**
 * Clean Scrape API Endpoint
 * 
 * Alternative scraping endpoint that uses clean browser configuration
 * without aggressive bypass techniques.
 * 
 * Use this when:
 * - Regular /api/scrape is getting blocked
 * - You want more stable, less detectable scraping
 * 
 * Trade-off:
 * - May not work on sites with aggressive protection
 * - But less likely to be detected and blocked
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withCleanPage } from '../server/browser-clean.js'
import { scrapeCarrier } from '../server/scrapers/index.js'
import { getCarrier } from '../server/carriers.js'
import { normalizeContainer, isValidContainer } from '../server/handlers/scrapeOne.js'
import type { CarrierId } from '../server/carriers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const containerNumber = normalizeContainer(req.query.container)
  const carrierIdRaw = String(req.query.carrier || '')

  if (!containerNumber || !isValidContainer(containerNumber)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_CONTAINER_NUMBER',
        message: 'Container number must match format: 4 letters + 7 digits (e.g. MSCU1234567)',
      },
    })
  }

  const carrierId = carrierIdRaw as CarrierId
  const carrier = getCarrier(carrierId)

  if (!carrier) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_CARRIER',
        message: `Unknown carrier: ${carrierIdRaw}`,
      },
    })
  }

  try {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      module: 'scrape-clean',
      message: 'Starting clean scrape',
      carrier: carrierId,
      container: containerNumber,
    }))

    const result = await withCleanPage(async (page) => {
      return scrapeCarrier(carrier, containerNumber, page)
    }, 45000)

    if (result.status === 'found' && result.data) {
      return res.status(200).json({
        ok: true,
        data: result.data,
        method: 'clean-browser',
      })
    }

    if (result.status === 'blocked') {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        module: 'scrape-clean',
        message: 'Blocked even with clean browser',
        carrier: carrierId,
        details: result.details,
      }))

      return res.status(403).json({
        ok: false,
        error: {
          code: 'SOURCE_BLOCKED',
          message: 'הסריקה נחסמה באתר החברה (הגנת בוטים)',
          details: result.details,
          recommendation: 'אתר זה חוסם אוטומציה. שקול להשתמש ב-API רשמי או בדיקה ידנית.',
        },
      })
    }

    if (result.status === 'not_found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'המכולה לא נמצאה במערכת של החברה',
        },
      })
    }

    // error status
    return res.status(500).json({
      ok: false,
      error: {
        code: 'SCRAPE_FAILED',
        message: result.details || 'הסריקה נכשלה',
      },
    })

  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      module: 'scrape-clean',
      message: 'Scrape error',
      carrier: carrierId,
      error: error instanceof Error ? error.message : String(error),
    }))

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'שגיאה פנימית',
      },
    })
  }
}

export const config = {
  maxDuration: 60,
}
