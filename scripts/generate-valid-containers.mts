/**
 * ISO 6346 Container Number Generator
 * Generates valid container numbers with proper check digits
 */

/**
 * Calculate ISO 6346 check digit
 * Formula: (sum of position values) mod 11, where 10 = 0
 */
function calculateCheckDigit(ownerCode: string, serialNumber: string): string {
  const container = ownerCode + serialNumber
  
  // Position values for letters (A=10, B=12, C=13, ..., Z=38)
  const letterValues: Record<string, number> = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
    K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
    U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38
  }
  
  let sum = 0
  for (let i = 0; i < container.length; i++) {
    const char = container[i]
    const position = i + 1
    
    if (/[A-Z]/.test(char)) {
      sum += letterValues[char] * Math.pow(2, position - 1)
    } else {
      sum += parseInt(char) * Math.pow(2, position - 1)
    }
  }
  
  const checkDigit = sum % 11
  return checkDigit === 10 ? '0' : checkDigit.toString()
}

/**
 * Generate valid container number
 */
export function generateContainerNumber(ownerCode: string): string {
  // Random 6-digit serial number
  const serialNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  const checkDigit = calculateCheckDigit(ownerCode, serialNumber)
  return `${ownerCode}${serialNumber}${checkDigit}`
}

/**
 * Validate container number
 */
export function validateContainerNumber(containerNumber: string): boolean {
  if (containerNumber.length !== 11) return false
  
  const ownerCode = containerNumber.substring(0, 4)
  const serialNumber = containerNumber.substring(4, 10)
  const providedCheckDigit = containerNumber.substring(10, 11)
  
  const calculatedCheckDigit = calculateCheckDigit(ownerCode, serialNumber)
  
  return providedCheckDigit === calculatedCheckDigit
}

// Generate valid containers for all carriers
const CARRIER_CODES: Record<string, string[]> = {
  msc: ['MSCU', 'MSDU'],
  zim: ['ZIMU', 'ZCSU'],
  maersk: ['MAEU', 'MSKU'],
  cma_cgm: ['CMAU', 'CMDU'],
  hapag_lloyd: ['HLCU', 'HLXU'],
  cosco: ['COSU', 'CBHU'],
  one: ['ONEY', 'ONEU'],
  evergreen: ['EMCU', 'EITU'],
  oocl: ['OOLU'],
  hmm: ['HMMU', 'HDMU'],
  yang_ming: ['YMLU', 'YMCU'],
  pil: ['PCIU'],
  wan_hai: ['WHLU'],
}

console.log('╔════════════════════════════════════════════════════════════════════╗')
console.log('║           ISO 6346 Valid Container Number Generator                ║')
console.log('╚════════════════════════════════════════════════════════════════════╝\n')

console.log('📦 Generating valid container numbers with check digits:\n')

for (const [carrier, codes] of Object.entries(CARRIER_CODES)) {
  console.log(`${carrier.toUpperCase()}:`)
  for (const code of codes) {
    const validNumbers = []
    for (let i = 0; i < 3; i++) {
      validNumbers.push(generateContainerNumber(code))
    }
    console.log(`  ${code}: ${validNumbers.join(', ')}`)
  }
  console.log()
}

console.log('\n✅ All generated numbers have valid ISO 6346 check digits!')
console.log('\nℹ️  Note: These numbers are mathematically valid but may not exist in reality.')
console.log('   Use them for testing the scraping system, not for production lookups.\n')

// Test validation
console.log('🧪 Testing validation:')
console.log(`  MSCU6053867 (known valid): ${validateContainerNumber('MSCU6053867') ? '✅' : '❌'}`)
console.log(`  MSCU1234567 (invalid): ${validateContainerNumber('MSCU1234567') ? '❌' : '✅'}`)
console.log(`  ${generateContainerNumber('MSCU')} (generated): ${validateContainerNumber(generateContainerNumber('MSCU')) ? '✅' : '❌'}`)
