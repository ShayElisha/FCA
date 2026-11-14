/**
 * Helper functions for scrapers using the Universal Bypass system
 */

import type { Page } from 'playwright-core'
import { getUniversalBypass } from './browser.js'

/**
 * Human-like delay - use this instead of page.waitForTimeout()
 */
export async function humanDelay(
  action: 'pageLoad' | 'cookieConsent' | 'inputClick' | 'inputType' | 'buttonClick' | 'mouseMove' | 'scroll'
): Promise<void> {
  const bypass = getUniversalBypass()
  await bypass.getBehavioral().delay(action)
}

/**
 * Move mouse like a human
 */
export async function humanMouseMove(page: Page): Promise<void> {
  const bypass = getUniversalBypass()
  await bypass.getBehavioral().humanMouseMove(page)
}

/**
 * Type text like a human (with occasional typos and corrections)
 */
export async function humanType(page: Page, locator: any, text: string): Promise<void> {
  const bypass = getUniversalBypass()
  await bypass.getBehavioral().humanType(page, locator, text)
}

/**
 * Scroll like a human
 */
export async function humanScroll(page: Page): Promise<void> {
  const bypass = getUniversalBypass()
  await bypass.getBehavioral().humanScroll(page)
}

/**
 * Record a successful scrape (helps adaptive learning)
 */
export function recordSuccess(): void {
  // Success recorded automatically by system
}

/**
 * Record a block (helps adaptive learning)
 */
export function recordBlock(url: string, detectionType: string): void {
  const bypass = getUniversalBypass()
  bypass.getAdaptive().recordBlock(url, detectionType)
}

/**
 * Check if we should wait before scraping (rate limiting)
 */
export async function checkRateLimit(url: string): Promise<void> {
  const bypass = getUniversalBypass()
  const waitMs = bypass.getAdaptive().shouldWait(url)
  
  if (waitMs > 0) {
    console.log(`⏳ Rate limiting: waiting ${waitMs / 1000}s before scraping ${url}`)
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }
}

/**
 * Smart cookie banner dismissal with human behavior
 */
export async function dismissCookieBanner(page: Page): Promise<void> {
  await humanDelay('cookieConsent')
  await humanMouseMove(page)
  
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("OK")',
    'button:has-text("I accept")',
    'button:has-text("I Accept")',
    'button:has-text("Agree")',
    'button:has-text("Continue")',
    'button:has-text("Got it")',
    'button:has-text("Confirm")',
    '[id*="accept" i][id*="cookie" i]',
    '[class*="accept" i][class*="cookie" i]',
    '#onetrust-accept-btn-handler',
    '.cookie-accept',
  ]
  
  for (const selector of selectors) {
    const btn = page.locator(selector).first()
    if (await btn.isVisible().catch(() => false)) {
      await humanMouseMove(page)
      await humanDelay('buttonClick')
      await btn.click({ timeout: 1500 }).catch(() => undefined)
      await humanDelay('pageLoad')
      break
    }
  }
}

/**
 * Smart input filling with human typing
 */
export async function fillInput(page: Page, containerNumber: string): Promise<boolean> {
  const selectors = [
    // Container-specific
    'input[name*="container" i]',
    'input[id*="container" i]',
    'input[placeholder*="container" i]',
    'input[aria-label*="container" i]',
    
    // Tracking
    'input[name*="tracking" i]',
    'input[id*="tracking" i]',
    'input[placeholder*="tracking" i]',
    'input[name="trackingNumber"]',
    
    // Shipment/cargo
    'input[name*="shipment" i]',
    'input[id*="shipment" i]',
    'input[name*="cargo" i]',
    
    // Generic
    'input[type="text"]',
    'input[type="search"]',
    'textarea',
  ]
  
  for (const selector of selectors) {
    const locator = page.locator(selector).first()
    if ((await locator.count().catch(() => 0)) === 0) continue
    if (!(await locator.isVisible().catch(() => false))) continue
    
    await humanMouseMove(page)
    await humanDelay('inputClick')
    
    // Click and clear
    await locator.click({ timeout: 1500 }).catch(() => undefined)
    await humanDelay('inputClick')
    await locator.clear().catch(() => undefined)
    await humanDelay('inputType')
    
    // Type like a human
    await humanType(page, locator, containerNumber)
    
    return true
  }
  
  return false
}

/**
 * Smart button click with human behavior
 */
export async function submitSearch(page: Page): Promise<void> {
  await humanDelay('buttonClick')
  await humanMouseMove(page)
  
  const selectors = [
    'button[type="submit"]',
    'button:has-text("Track")',
    'button:has-text("Search")',
    'button:has-text("Find")',
    'button:has-text("Query")',
    'input[type="submit"]',
    'input[type="button"][value*="Search" i]',
    '[role="button"]:has-text("Track")',
  ]
  
  for (const selector of selectors) {
    const locator = page.locator(selector).first()
    if ((await locator.count().catch(() => 0)) === 0) continue
    if (!(await locator.isVisible().catch(() => false))) continue
    
    await humanMouseMove(page)
    await humanDelay('buttonClick')
    await locator.click({ timeout: 2000 }).catch(() => undefined)
    return
  }
  
  // Fallback: press Enter
  await humanDelay('inputType')
  await page.keyboard.press('Enter')
}

/**
 * Wait for page to settle with human-like patience
 */
export async function waitForSettlement(page: Page, options?: {
  minWait?: number
  maxWait?: number
  checkInterval?: number
}): Promise<void> {
  const minWait = options?.minWait || 1000
  const maxWait = options?.maxWait || 15000
  const checkInterval = options?.checkInterval || 500
  
  await humanDelay('pageLoad')
  
  const startTime = Date.now()
  let lastTextLength = 0
  let stableCount = 0
  
  while (Date.now() - startTime < maxWait) {
    const text = await page.locator('body').innerText().catch(() => '')
    
    if (text.length === lastTextLength) {
      stableCount++
      if (stableCount >= 3 && Date.now() - startTime >= minWait) {
        break
      }
    } else {
      stableCount = 0
      lastTextLength = text.length
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }
}
