import { scrapeOneCarrier } from '../server/handlers/scrapeOne.ts'

const container = process.argv[2] ?? 'MSCU6789016'
const result = await scrapeOneCarrier(container, 'msc')
console.log(JSON.stringify(result, null, 2))
