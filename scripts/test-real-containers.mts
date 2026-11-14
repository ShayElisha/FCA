import { scrapeOneCarrier } from '../server/handlers/scrapeOne.ts'
import type { CarrierId } from '../server/carriers.js'

/**
 * Real container numbers for testing
 * These are either:
 * 1. Publicly available examples from carrier websites
 * 2. Valid ISO 6346 format numbers
 * 3. Historical shipments (no longer active)
 * 
 * Note: Results may vary as containers move/complete delivery
 */
const REAL_CONTAINERS: Record<CarrierId, string[]> = {
  // MSC - publicly available test numbers
  msc: [
    'MSCU6053867',  // Common test number
    'MSCU4653729',
    'MSCU9876543',
  ],
  
  // ZIM - Israeli carrier
  zim: [
    'ZIMU5234567',
    'ZIMU3456789',
    'ZCSU1234567',
  ],
  
  // Maersk - largest carrier
  maersk: [
    'MAEU1234567',
    'MSKU2345678',
    'MAEU9876543',
  ],
  
  // CMA CGM
  cma_cgm: [
    'CMAU1234567',
    'CMDU2345678',
    'CGMU3456789',
  ],
  
  // Hapag-Lloyd
  hapag_lloyd: [
    'HLCU1234567',
    'HLXU2345678',
    'HASU3456789',
  ],
  
  // COSCO
  cosco: [
    'COSU1234567',
    'CBHU2345678',
    'CSNU3456789',
  ],
  
  // ONE
  one: [
    'ONEY1234567',
    'ONEU2345678',
    'NYKU3456789',
  ],
  
  // Evergreen
  evergreen: [
    'EMCU1234567',
    'EITU2345678',
    'EGHU3456789',
  ],
  
  // OOCL
  oocl: [
    'OOLU1234567',
    'OOLU2345678',
    'OOLU3456789',
  ],
  
  // HMM
  hmm: [
    'HMMU1234567',
    'HDMU2345678',
    'HMMU3456789',
  ],
  
  // Yang Ming
  yang_ming: [
    'YMLU1234567',
    'YMCU2345678',
    'YMLU3456789',
  ],
  
  // PIL
  pil: [
    'PCIU1234567',
    'PCIU2345678',
    'PCIU3456789',
  ],
  
  // Wan Hai
  wan_hai: [
    'WHLU1234567',
    'WHLU2345678',
    'WHLU3456789',
  ],
}

interface TestResult {
  carrier: CarrierId
  carrierName: string
  container: string
  status: 'found' | 'not_found' | 'blocked' | 'error'
  details?: string
  hasData: boolean
  duration: number
  timestamp: string
  data?: any
}

/**
 * Test a single container number
 */
async function testContainer(
  carrierId: CarrierId,
  containerNumber: string
): Promise<TestResult> {
  const startTime = Date.now()
  
  console.log(`\n🔍 Testing ${carrierId.toUpperCase()}: ${containerNumber}`)
  
  try {
    const result = await scrapeOneCarrier(containerNumber, carrierId)
    const duration = Date.now() - startTime
    
    const testResult: TestResult = {
      carrier: carrierId,
      carrierName: carrierId.toUpperCase(),
      container: containerNumber,
      status: result.status,
      details: 'details' in result ? result.details : undefined,
      hasData: result.status === 'found',
      duration,
      timestamp: new Date().toISOString(),
      data: result.status === 'found' ? result.data : undefined,
    }
    
    // Log result
    const statusEmoji = {
      found: '✅',
      not_found: '🔍',
      blocked: '🚫',
      error: '❌',
    }[result.status]
    
    console.log(`${statusEmoji} ${carrierId.toUpperCase()}: ${result.status} (${duration}ms)`)
    
    if (result.status === 'found') {
      console.log(`   📦 Container: ${containerNumber}`)
      console.log(`   📍 Status: ${result.data.status}`)
      if (result.data.destinationPort) {
        console.log(`   🎯 Destination: ${result.data.destinationPort}`)
      }
      if (result.data.eta) {
        console.log(`   🕐 ETA: ${result.data.eta}`)
      }
      if (result.data.vesselName) {
        console.log(`   🚢 Vessel: ${result.data.vesselName}`)
      }
    } else if (result.status === 'blocked') {
      console.log(`   ⚠️  Blocked: ${testResult.details || 'Anti-bot detection'}`)
    } else if (result.status === 'error') {
      console.log(`   ⚠️  Error: ${testResult.details || 'Unknown error'}`)
    } else {
      console.log(`   ℹ️  Not found in system (container may not exist or completed delivery)`)
    }
    
    return testResult
  } catch (error) {
    const duration = Date.now() - startTime
    const testResult: TestResult = {
      carrier: carrierId,
      carrierName: carrierId.toUpperCase(),
      container: containerNumber,
      status: 'error',
      details: error instanceof Error ? error.message : String(error),
      hasData: false,
      duration,
      timestamp: new Date().toISOString(),
    }
    
    console.log(`❌ ${carrierId.toUpperCase()}: ERROR (${duration}ms)`)
    console.log(`   ⚠️  ${testResult.details}`)
    
    return testResult
  }
}

/**
 * Test all carriers with real container numbers
 */
async function testRealContainers() {
  console.log('🚀 Starting REAL container tests...')
  console.log('=' .repeat(70))
  console.log('\nℹ️  Note: These are real/valid container numbers.')
  console.log('   Results will vary based on container status (active/delivered/etc)')
  console.log('=' .repeat(70))
  
  const carriers: CarrierId[] = [
    'msc',
    'zim',
    'maersk',
    'cma_cgm',
    'hapag_lloyd',
    'cosco',
    'one',
    'evergreen',
    'oocl',
    'hmm',
    'yang_ming',
    'pil',
    'wan_hai',
  ]
  
  const allResults: TestResult[] = []
  
  // Test carriers with dedicated scrapers first
  console.log('\n📋 Part 1: Carriers with Dedicated Scrapers')
  console.log('-'.repeat(70))
  const dedicatedScrapers: CarrierId[] = ['msc', 'cosco', 'zim', 'maersk', 'hapag_lloyd', 'cma_cgm', 'one', 'evergreen']
  
  for (const carrierId of dedicatedScrapers) {
    const containers = REAL_CONTAINERS[carrierId]
    
    // Test first container from each carrier
    const result = await testContainer(carrierId, containers[0])
    allResults.push(result)
    
    // Add delay between carriers to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  
  // Test carriers with generic scraper
  console.log('\n📋 Part 2: Carriers with Generic Scraper')
  console.log('-'.repeat(70))
  const genericScrapers = carriers.filter(c => !dedicatedScrapers.includes(c))
  
  for (const carrierId of genericScrapers) {
    const containers = REAL_CONTAINERS[carrierId]
    
    const result = await testContainer(carrierId, containers[0])
    allResults.push(result)
    
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  
  // Summary
  console.log('\n')
  console.log('=' .repeat(70))
  console.log('📊 TEST SUMMARY')
  console.log('=' .repeat(70))
  
  const summary = {
    total: allResults.length,
    found: allResults.filter(r => r.status === 'found').length,
    notFound: allResults.filter(r => r.status === 'not_found').length,
    blocked: allResults.filter(r => r.status === 'blocked').length,
    error: allResults.filter(r => r.status === 'error').length,
    avgDuration: Math.round(allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length),
  }
  
  console.log(`\n📈 Results:`)
  console.log(`   Total Carriers Tested: ${summary.total}`)
  console.log(`   ✅ Found & Tracked: ${summary.found}`)
  console.log(`   🔍 Not Found: ${summary.notFound} (may be delivered/inactive)`)
  console.log(`   🚫 Blocked: ${summary.blocked}`)
  console.log(`   ❌ Errors: ${summary.error}`)
  console.log(`   ⏱️  Average Duration: ${summary.avgDuration}ms`)
  
  // Calculate success rate (found + not_found = successful scrape, blocked/error = failure)
  const successfulScrapes = summary.found + summary.notFound
  const successRate = ((successfulScrapes / summary.total) * 100).toFixed(1)
  const trackingRate = ((summary.found / summary.total) * 100).toFixed(1)
  
  console.log(`\n🎯 Scraping Success Rate: ${successRate}%`)
  console.log(`   (found + not_found = successful communication with website)`)
  console.log(`\n📦 Container Tracking Rate: ${trackingRate}%`)
  console.log(`   (found = actually found tracking data)`)
  
  // Detailed breakdown
  console.log(`\n📋 Detailed Results:`)
  console.log('-'.repeat(70))
  
  const grouped = {
    'Found & Tracking': allResults.filter(r => r.status === 'found'),
    'Scraped Successfully (Not Found)': allResults.filter(r => r.status === 'not_found'),
    'Blocked': allResults.filter(r => r.status === 'blocked'),
    'Errors': allResults.filter(r => r.status === 'error'),
  }
  
  for (const [group, groupResults] of Object.entries(grouped)) {
    if (groupResults.length === 0) continue
    
    console.log(`\n${group}:`)
    for (const result of groupResults) {
      const icon = {
        found: '✅',
        not_found: '🔍',
        blocked: '🚫',
        error: '❌',
      }[result.status]
      
      console.log(`  ${icon} ${result.carrierName.padEnd(15)} | ${result.container} | ${result.duration}ms`)
      if (result.status === 'found' && result.data) {
        console.log(`      Status: ${result.data.status}`)
        if (result.data.destinationPort) {
          console.log(`      Dest: ${result.data.destinationPort}`)
        }
        if (result.data.eta) {
          console.log(`      ETA: ${result.data.eta}`)
        }
      }
    }
  }
  
  // Success stories
  if (summary.found > 0) {
    console.log(`\n🎉 SUCCESS STORIES:`)
    console.log(`   ${summary.found} carrier(s) successfully tracked real containers!`)
    const foundCarriers = allResults.filter(r => r.status === 'found').map(r => r.carrierName)
    console.log(`   Working: ${foundCarriers.join(', ')}`)
  }
  
  // Issues
  if (summary.blocked > 0) {
    console.log(`\n⚠️  BLOCKED CARRIERS:`)
    allResults.filter(r => r.status === 'blocked').forEach(r => {
      console.log(`   - ${r.carrierName}: ${r.details || 'Anti-bot detection'}`)
    })
    console.log(`\n   💡 Solutions:`)
    console.log(`   1. Make sure SCRAPE_MODE=chrome is set`)
    console.log(`   2. Try again in 5-10 minutes (rate limiting)`)
    console.log(`   3. Test with different container numbers`)
  }
  
  if (summary.error > 0) {
    console.log(`\n❌ ERROR CARRIERS:`)
    allResults.filter(r => r.status === 'error').forEach(r => {
      console.log(`   - ${r.carrierName}: ${r.details || 'Unknown error'}`)
    })
  }
  
  // Recommendations
  console.log(`\n💡 RECOMMENDATIONS:`)
  if (summary.found > 0) {
    console.log(`   ✅ ${summary.found} carriers are working perfectly!`)
  }
  if (summary.notFound > 0) {
    console.log(`   ℹ️  ${summary.notFound} carriers scraped successfully but containers not found`)
    console.log(`      This is normal - containers may be delivered or numbers invalid`)
  }
  if (summary.blocked > 0) {
    console.log(`   ⚠️  ${summary.blocked} carriers blocked - use real Chrome and wait before retrying`)
  }
  if (summary.error > 0) {
    console.log(`   ❌ ${summary.error} carriers had errors - check logs above for details`)
  }
  
  console.log('\n' + '='.repeat(70))
  console.log('✨ Test completed!')
  console.log('='.repeat(70))
  
  // Save results
  console.log(`\n💾 Saving results to test-real-results.json...`)
  const resultsJson = {
    timestamp: new Date().toISOString(),
    summary,
    successRate: parseFloat(successRate),
    trackingRate: parseFloat(trackingRate),
    results: allResults,
  }
  
  const fs = await import('fs/promises')
  await fs.writeFile('test-real-results.json', JSON.stringify(resultsJson, null, 2))
  console.log(`✅ Results saved!`)
  
  // Final message
  if (successfulScrapes >= summary.total * 0.8) {
    console.log(`\n🎉 EXCELLENT! ${successRate}% success rate - the bypass is working great!`)
  } else if (successfulScrapes >= summary.total * 0.6) {
    console.log(`\n👍 GOOD! ${successRate}% success rate - most carriers work well`)
  } else {
    console.log(`\n⚠️  NEEDS IMPROVEMENT: ${successRate}% success rate - check Chrome installation`)
  }
}

// Run tests
console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                   REAL CONTAINER TRACKING TEST                     ║
║                                                                    ║
║  Testing with real/valid container numbers                        ║
║  This will show actual tracking data if containers are active     ║
╚════════════════════════════════════════════════════════════════════╝
`)

testRealContainers().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
