import type { Carrier } from '../carriers.js'
import { withPage } from '../browser.js'
import type { CarrierScrapeOutcome } from '../types.js'
import { scrapeCarrierPage } from './generic.js'
import { scrapeMsc } from './msc.js'

export async function scrapeCarrier(
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  return withPage(async (page) => {
    if (carrier.id === 'msc') {
      return scrapeMsc(page, carrier, containerNumber)
    }
    return scrapeCarrierPage(page, carrier, containerNumber)
  })
}
