import type { Carrier } from '../carriers.js'
import { withPage } from '../browser.js'
import type { CarrierScrapeOutcome } from '../types.js'
import { scrapeCosco } from './cosco.js'
import { scrapeCarrierPage } from './generic.js'
import { scrapeMsc } from './msc.js'
import { scrapeZim } from './zim.js'
import { scrapeMaersk } from './maersk.js'
import { scrapeHapag } from './hapag.js'
import { scrapeCma } from './cma.js'

export async function scrapeCarrier(
  carrier: Carrier,
  containerNumber: string,
): Promise<CarrierScrapeOutcome> {
  return withPage(async (page) => {
    if (carrier.id === 'msc') {
      return scrapeMsc(page, carrier, containerNumber)
    }
    if (carrier.id === 'cosco') {
      return scrapeCosco(page, carrier, containerNumber)
    }
    if (carrier.id === 'zim') {
      return scrapeZim(page, carrier, containerNumber)
    }
    if (carrier.id === 'maersk') {
      return scrapeMaersk(page, carrier, containerNumber)
    }
    if (carrier.id === 'hapag_lloyd') {
      return scrapeHapag(page, carrier, containerNumber)
    }
    if (carrier.id === 'cma_cgm') {
      return scrapeCma(page, carrier, containerNumber)
    }
    return scrapeCarrierPage(page, carrier, containerNumber)
  })
}
