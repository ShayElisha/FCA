import type { VercelRequest, VercelResponse } from '@vercel/node'
import trackHandler from './track.js'

export const config = {
  maxDuration: 60,
}

/**
 * Alias of /api/track (single-carrier when carrierId is provided).
 * Kept for backwards compatibility.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return trackHandler(req, res)
}
