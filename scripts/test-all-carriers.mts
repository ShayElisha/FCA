import { scrapeOneCarrier } from '../server/handlers/scrapeOne.ts'
import type { CarrierId } from '../server/carriers.js'

// Test container numbers for each carrier
// These are example formats - may not be real active containers
const TEST_CONTAINERS: Record<CarrierId, string> = {
  msc: 'MSCU6789016',
  zim: 'ZIMU1234567',
  maersk: 'MAEU1234567',
  cma_cgm: 'CMDU1234567',
  hapag_lloyd: 'HLCU1234567',
  cosco: 'COSU1234567',
  one: 'ONEY1234567',
  evergreen: 'EMCU1234567',
  oocl: 'OOLU1234567',
  hmm: 'HMMU1234567',
  yang_ming: 'YMLU1234567',
  pil: 'PCIU1234567',
  wan_hai: 'WHLU1234567',
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
}

async function testCarrier(carrierId: CarrierId): Promise<TestResult> {
  const container = TEST_CONTAINERS[carrierId]
  const startTime = Date.now()
  
  console.log(`\n🔍 Testing ${carrierId.toUpperCase()} with container ${container}...`)
  
  try {
    const result = await scrapeOneCarrier(container, carrierId)
    const duration = Date.now() - startTime
    
    const testResult: TestResult = {
      carrier: carrierId,
      carrierName: carrierId.toUpperCase(),
      container,
      status: result.status,
      details: 'details' in result ? result.details : undefined,
      hasData: result.status === 'found',
      duration,
      timestamp: new Date().toISOString(),
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
      console.log(`   📦 Data: Container found with tracking info`)
    } else if (result.status === 'blocked') {
      console.log(`   ⚠️  Blocked: ${testResult.details || 'Anti-bot detection'}`)
    } else if (result.status === 'error') {
      console.log(`   ⚠️  Error: ${testResult.details || 'Unknown error'}`)
    } else {
      console.log(`   ℹ️  Not found: Container number not in system (expected for test numbers)`)
    }
    
    return testResult
  } catch (error) {
    const duration = Date.now() - startTime
    const testResult: TestResult = {
      carrier: carrierId,
      carrierName: carrierId.toUpperCase(),
      container,
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

async function testAllCarriers() {
  console.log('🚀 Starting comprehensive carrier tests...')
  console.log('=' .repeat(60))
  
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
  
  const results: TestResult[] = []
  
  // Test carriers with dedicated scrapers first
  console.log('\n📋 Part 1: Carriers with Dedicated Scrapers')
  console.log('-'.repeat(60))
  const dedicatedScrapers: CarrierId[] = ['msc', 'cosco', 'zim', 'maersk', 'hapag_lloyd', 'cma_cgm']
  
  for (const carrierId of dedicatedScrapers) {
    const result = await testCarrier(carrierId)
    results.push(result)
    // Add delay between tests to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  // Test carriers with generic scraper
  console.log('\n📋 Part 2: Carriers with Generic Scraper')
  console.log('-'.repeat(60))
  const genericScrapers = carriers.filter(c => !dedicatedScrapers.includes(c))
  
  for (const carrierId of genericScrapers) {
    const result = await testCarrier(carrierId)
    results.push(result)
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  // Summary
  console.log('\n')
  console.log('=' .repeat(60))
  console.log('📊 TEST SUMMARY')
  console.log('=' .repeat(60))
  
  const summary = {
    total: results.length,
    found: results.filter(r => r.status === 'found').length,
    notFound: results.filter(r => r.status === 'not_found').length,
    blocked: results.filter(r => r.status === 'blocked').length,
    error: results.filter(r => r.status === 'error').length,
    avgDuration: Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length),
  }
  
  console.log(`\n📈 Results:`)
  console.log(`   Total Carriers Tested: ${summary.total}`)
  console.log(`   ✅ Found: ${summary.found}`)
  console.log(`   🔍 Not Found: ${summary.notFound} (expected for test container numbers)`)
  console.log(`   🚫 Blocked: ${summary.blocked}`)
  console.log(`   ❌ Errors: ${summary.error}`)
  console.log(`   ⏱️  Average Duration: ${summary.avgDuration}ms`)
  
  // Success rate (not_found is OK, blocked/error is failure)
  const successRate = ((summary.found + summary.notFound) / summary.total * 100).toFixed(1)
  console.log(`\n🎯 Success Rate: ${successRate}%`)
  console.log(`   (Successful = found OR not_found, Failed = blocked OR error)`)
  
  // Detailed breakdown
  console.log(`\n📋 Detailed Results:`)
  console.log('-'.repeat(60))
  
  const grouped = {
    'Dedicated Scrapers': results.filter(r => dedicatedScrapers.includes(r.carrier)),
    'Generic Scraper': results.filter(r => !dedicatedScrapers.includes(r.carrier)),
  }
  
  for (const [group, groupResults] of Object.entries(grouped)) {
    console.log(`\n${group}:`)
    for (const result of groupResults) {
      const icon = {
        found: '✅',
        not_found: '🔍',
        blocked: '🚫',
        error: '❌',
      }[result.status]
      
      console.log(`  ${icon} ${result.carrierName.padEnd(15)} | ${result.status.padEnd(10)} | ${result.duration}ms`)
    }
  }
  
  // Blocked carriers warning
  if (summary.blocked > 0) {
    console.log(`\n⚠️  WARNING: ${summary.blocked} carrier(s) blocked the request`)
    console.log(`   Blocked carriers:`)
    results.filter(r => r.status === 'blocked').forEach(r => {
      console.log(`   - ${r.carrierName}: ${r.details || 'Anti-bot detection'}`)
    })
    console.log(`\n   Recommendations:`)
    console.log(`   1. Make sure you're using real Chrome (SCRAPE_MODE=chrome)`)
    console.log(`   2. Increase timeouts if needed`)
    console.log(`   3. Test with real container numbers from these carriers`)
    console.log(`   4. Consider adding more delays in the scraper`)
  }
  
  // Error carriers
  if (summary.error > 0) {
    console.log(`\n❌ ERRORS: ${summary.error} carrier(s) had errors`)
    console.log(`   Error carriers:`)
    results.filter(r => r.status === 'error').forEach(r => {
      console.log(`   - ${r.carrierName}: ${r.details || 'Unknown error'}`)
    })
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('✨ Test completed!')
  console.log('=' .repeat(60))
  
  // Save results to file
  const resultsJson = {
    timestamp: new Date().toISOString(),
    summary,
    results,
  }
  
  console.log(`\n💾 Saving results to test-results.json...`)
  const fs = await import('fs/promises')
  await fs.writeFile('test-results.json', JSON.stringify(resultsJson, null, 2))
  console.log(`✅ Results saved!`)
}

// Run tests
testAllCarriers().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
