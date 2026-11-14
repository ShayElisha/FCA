import type { Page } from 'playwright-core'
import type { Carrier } from '../carriers.js'
import type { CarrierScrapeOutcome } from '../types.js'
import { scrapeCarrierPage } from './generic.js'

/** MSC uses the shared fast scraper (direct URL + short waits). */
export async function scrapeMsc(
  page: Page,
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  return scrapeCarrierPage(page, carrier, containerNumber)
}
