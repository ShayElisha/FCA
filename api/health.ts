import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    mode: 'vercel-serverless-scrape',
    runtime: 'nodejs',
    note: 'MSC/Akamai often blocks serverless Chromium. Use npm run dev with Google Chrome locally for reliable MSC tracking.',
  })
}
