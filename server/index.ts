import cors from 'cors'
import express from 'express'
import { closeBrowser } from './browser.js'
import { CARRIERS, type CarrierId } from './carriers.js'
import {
  isValidContainer,
  normalizeContainer,
  scrapeOneCarrier,
} from './handlers/scrapeOne.js'
import { searchAcrossCarriers } from './search.js'

const app = express()
const PORT = Number(process.env.PORT ?? 8787)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: process.env.SCRAPE_MODE === 'chrome' ? 'chrome-host' : 'local-scrape',
    message:
      'Chrome/Playwright scraper host — point Vercel SCRAPER_UPSTREAM_URL here',
  })
})

async function handleTrackOrScrape(
  req: express.Request,
  res: express.Response,
) {
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

  // Single-carrier (UI fan-out)
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

  // Multi-carrier SSE
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }

  try {
    for await (const event of searchAcrossCarriers(containerNumber)) {
      send(event)
      if (event.type === 'result') break
    }
  } catch (error) {
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
}

app.post('/api/track', handleTrackOrScrape)
app.post('/api/scrape', handleTrackOrScrape)

app.get(['/api/track', '/api/scrape'], (_req, res) => {
  res.setHeader('Allow', 'POST, OPTIONS')
  res.status(405).json({
    ok: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'יש לשלוח POST עם { containerNumber, carrierId? }',
    },
  })
})

const server = app.listen(PORT, () => {
  console.log(`FCA scraper server on http://localhost:${PORT}`)
  console.log('Endpoints: POST /api/scrape , POST /api/track')
})

async function shutdown() {
  server.close()
  await closeBrowser()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
