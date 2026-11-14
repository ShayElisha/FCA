/**
 * Improved Scraper Helpers
 * 
 * Better selector strategies for modern React/Angular/Vue SPAs
 * with dynamic class names and component-based structures.
 */

import type { Page, Locator } from 'playwright-core'

export function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, delay))
}

export async function humanLikeMouseMove(page: Page): Promise<void> {
  const x = Math.floor(Math.random() * 500) + 100
  const y = Math.floor(Math.random() * 300) + 100
  await page.mouse.move(x, y).catch(() => undefined)
  await randomDelay(50, 150)
}

/**
 * Improved input finder with comprehensive selectors
 * Supports modern SPA frameworks and dynamic class names
 */
export async function findAndFillInput(
  page: Page,
  value: string,
  options: {
    inputType?: 'container' | 'tracking' | 'search' | 'general'
    timeoutMs?: number
  } = {}
): Promise<boolean> {
  const { inputType = 'container', timeoutMs = 5000 } = options
  
  // Build comprehensive selector list
  const selectors = buildInputSelectors(inputType)
  
  // Try each selector with timeout
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first()
      
      // Wait for element to be visible
      await locator.waitFor({ state: 'visible', timeout: 1000 }).catch(() => null)
      
      const count = await locator.count().catch(() => 0)
      if (count === 0) continue
      
      const isVisible = await locator.isVisible().catch(() => false)
      if (!isVisible) continue
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'debug',
        module: 'improved-helpers',
        message: 'Found input element',
        selector,
      }))
      
      // Click to focus
      await locator.click({ timeout: 1500 }).catch(() => undefined)
      await randomDelay(150, 300)
      
      // Clear existing content
      await locator.clear().catch(() => undefined)
      await randomDelay(100, 200)
      
      // Type with human-like delay
      for (const char of value) {
        await locator.type(char, { delay: Math.floor(Math.random() * 100) + 50 })
      }
      
      await randomDelay(300, 500)
      
      // Verify value was entered
      const inputValue = await locator.inputValue().catch(() => '')
      if (inputValue.includes(value)) {
        return true
      }
      
    } catch (error) {
      // Continue to next selector
      continue
    }
  }
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'warn',
    module: 'improved-helpers',
    message: 'Could not find input element',
    inputType,
    selectorsAttempted: selectors.length,
  }))
  
  return false
}

/**
 * Build comprehensive input selectors based on type
 */
function buildInputSelectors(inputType: string): string[] {
  const baseSelectors = [
    // By name attribute
    `input[name*="${inputType}" i]`,
    'input[name*="container" i]',
    'input[name*="tracking" i]',
    'input[name*="number" i]',
    'input[name*="search" i]',
    'input[name="query"]',
    'input[name="q"]',
    
    // By ID
    `input[id*="${inputType}" i]`,
    'input[id*="container" i]',
    'input[id*="tracking" i]',
    'input[id*="number" i]',
    'input[id*="search" i]',
    
    // By placeholder
    `input[placeholder*="${inputType}" i]`,
    'input[placeholder*="container" i]',
    'input[placeholder*="tracking" i]',
    'input[placeholder*="number" i]',
    'input[placeholder*="enter" i]',
    
    // By class (common patterns)
    'input[class*="container" i]',
    'input[class*="tracking" i]',
    'input[class*="search" i]',
    'input[class*="input" i]',
    
    // By aria-label
    'input[aria-label*="container" i]',
    'input[aria-label*="tracking" i]',
    'input[aria-label*="number" i]',
    
    // By data attributes (React/Vue)
    'input[data-test*="container" i]',
    'input[data-testid*="container" i]',
    'input[data-cy*="container" i]',
    'input[data-test*="tracking" i]',
    'input[data-testid*="tracking" i]',
    
    // MUI/Material-UI patterns
    'input[class*="MuiInput"]',
    'input[class*="MuiTextField"]',
    '.MuiInput-input',
    '.MuiTextField-input',
    
    // Ant Design patterns
    'input[class*="ant-input"]',
    '.ant-input',
    
    // Generic fallbacks (use last)
    'input[type="text"]:visible',
    'input[type="search"]:visible',
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
  ]
  
  return baseSelectors
}

/**
 * Improved submit button finder
 */
export async function findAndClickSubmit(page: Page): Promise<boolean> {
  const selectors = [
    // By type
    'button[type="submit"]',
    'input[type="submit"]',
    
    // By text content
    'button:has-text("Track")',
    'button:has-text("Search")',
    'button:has-text("Find")',
    'button:has-text("Submit")',
    'button:has-text("Go")',
    'button:has-text("Retrieve")',
    
    // Case insensitive text
    'button:text-is("TRACK")',
    'button:text-is("SEARCH")',
    
    // By class
    'button[class*="submit" i]',
    'button[class*="search" i]',
    'button[class*="track" i]',
    '.submit-button',
    '.search-button',
    '.track-button',
    
    // By aria-label
    'button[aria-label*="search" i]',
    'button[aria-label*="submit" i]',
    'button[aria-label*="track" i]',
    
    // By data attributes
    'button[data-test*="submit" i]',
    'button[data-testid*="submit" i]',
    'button[data-test*="search" i]',
    
    // MUI/Ant Design
    'button[class*="MuiButton"]',
    'button[class*="ant-btn-primary"]',
    '.ant-btn-primary',
    
    // Generic primary button
    'button[class*="primary" i]',
    'button.primary',
  ]
  
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first()
      
      await locator.waitFor({ state: 'visible', timeout: 1000 }).catch(() => null)
      
      const count = await locator.count().catch(() => 0)
      if (count === 0) continue
      
      const isVisible = await locator.isVisible().catch(() => false)
      if (!isVisible) continue
      
      const isEnabled = await locator.isEnabled().catch(() => false)
      if (!isEnabled) continue
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'debug',
        module: 'improved-helpers',
        message: 'Found submit button',
        selector,
      }))
      
      await humanLikeMouseMove(page)
      await randomDelay(150, 300)
      await locator.click({ timeout: 2000 }).catch(() => undefined)
      
      return true
    } catch (error) {
      continue
    }
  }
  
  // Fallback: press Enter
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'debug',
    module: 'improved-helpers',
    message: 'No submit button found, using Enter key',
  }))
  
  await randomDelay(100, 200)
  await page.keyboard.press('Enter')
  
  return true
}

/**
 * Improved cookie banner dismissal
 */
export async function dismissCookieBanners(page: Page): Promise<void> {
  await randomDelay(400, 700)
  
  const selectors = [
    // Text-based
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("OK")',
    'button:has-text("I accept")',
    'button:has-text("I Accept")',
    'button:has-text("Agree")',
    'button:has-text("Got it")',
    'button:has-text("Continue")',
    'button:has-text("Allow")',
    'button:has-text("Allow all")',
    
    // Class-based
    '.cookie-accept',
    '.cookie-consent-accept',
    '.accept-cookies',
    '[class*="cookie" i][class*="accept" i]',
    '[class*="consent" i][class*="accept" i]',
    
    // ID-based
    '#accept-cookies',
    '#cookie-accept',
    '#onetrust-accept-btn-handler',
    
    // Data attributes
    '[data-test*="cookie" i][data-test*="accept" i]',
    '[data-cy*="accept" i]',
    
    // Common cookie consent frameworks
    '#onetrust-accept-btn-handler', // OneTrust
    '.optanon-alert-box-button-middle', // OneTrust
    '.cookie-notice-accept', // Generic
    'button[class*="CybotCookiebotDialogBodyButton"]', // Cookiebot
  ]
  
  for (const selector of selectors) {
    try {
      const btn = page.locator(selector).first()
      const isVisible = await btn.isVisible().catch(() => false)
      
      if (isVisible) {
        await humanLikeMouseMove(page)
        await randomDelay(200, 400)
        await btn.click({ timeout: 1500 }).catch(() => undefined)
        await randomDelay(600, 900)
        break
      }
    } catch (error) {
      continue
    }
  }
}

/**
 * Check if page is blocked by anti-bot
 */
export function detectBlocking(pageText: string): {
  blocked: boolean
  reason?: string
} {
  const blockPatterns = [
    { pattern: /access denied/i, reason: 'Access denied' },
    { pattern: /cloudflare/i, reason: 'Cloudflare challenge' },
    { pattern: /captcha/i, reason: 'CAPTCHA required' },
    { pattern: /verify you are human/i, reason: 'Human verification' },
    { pattern: /checking your browser/i, reason: 'Browser check' },
    { pattern: /attention required/i, reason: 'Attention required' },
    { pattern: /ray id:/i, reason: 'Cloudflare Ray ID' },
    { pattern: /enable javascript/i, reason: 'JavaScript required' },
  ]
  
  for (const { pattern, reason } of blockPatterns) {
    if (pattern.test(pageText)) {
      return { blocked: true, reason }
    }
  }
  
  return { blocked: false }
}

/**
 * Wait for content to load with smart retry
 */
export async function waitForContent(
  page: Page,
  options: {
    successPatterns?: RegExp[]
    failurePatterns?: RegExp[]
    timeoutMs?: number
  } = {}
): Promise<{ success: boolean; text: string; reason?: string }> {
  const {
    successPatterns = [/eta|vessel|voyage|port|status|container/i],
    failurePatterns = [/no results|not found|invalid/i],
    timeoutMs = 15000,
  } = options
  
  const deadline = Date.now() + timeoutMs
  
  while (Date.now() < deadline) {
    const text = await page.locator('body').innerText().catch(() => '')
    
    // Check for blocking
    const blockCheck = detectBlocking(text)
    if (blockCheck.blocked) {
      return { success: false, text, reason: blockCheck.reason }
    }
    
    // Check for failure patterns
    for (const pattern of failurePatterns) {
      if (pattern.test(text)) {
        return { success: false, text, reason: 'Not found' }
      }
    }
    
    // Check for success patterns
    for (const pattern of successPatterns) {
      if (pattern.test(text)) {
        return { success: true, text }
      }
    }
    
    await randomDelay(600, 900)
  }
  
  // Timeout - return what we have
  const text = await page.locator('body').innerText().catch(() => '')
  return { success: false, text, reason: 'Timeout' }
}
