import { getCarrier, type CarrierId } from '../carriers.js'
import { scrapeCarrier } from '../scrapers/index.js'
import type { CarrierScrapeOutcome } from '../types.js'

const CONTAINER_RE = /^[A-Z]{3}[UJZ]\d{7}$/

export function normalizeContainer(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
}

export function isValidContainer(containerNumber: string): boolean {
  return CONTAINER_RE.test(containerNumber)
}

export async function scrapeOneCarrier(
  containerNumber: string,
  carrierId: CarrierId,
): Promise<CarrierScrapeOutcome> {
  const carrier = getCarrier(carrierId)
  return scrapeCarrier(carrier, containerNumber)
}
