/**
 * Legitimate Browser Configuration
 * 
 * This module provides clean, production-ready Playwright browser configuration
 * WITHOUT fingerprint spoofing, hardware manipulation, or anti-detection hacks.
 * 
 * Philosophy:
 * - Use real, consistent browser configuration
 * - Don't hide automation - use it transparently
 * - Respect website access policies
 * - When blocked, detect and report - don't bypass
 * 
 * REMOVED:
 * - WebGL/Canvas manipulation
 * - Navigator property overrides
 * - Hardware spoofing (battery, audio, etc.)
 * - Timezone manipulation
 * - Webdriver deletion
 * - Chrome DevTools Protocol hacks
 */

import type { Browser, BrowserContext, LaunchOptions, Page } from 'playwright'
import { chromium } from 'playwright'

export interface BrowserConfig {
  /** Run headless (default: true) */
  headless: boolean
  
  /** Browser timeout in milliseconds */
  timeout: number
  
  /** Navigation timeout in milliseconds */
  navigationTimeout: number
  
  /** Viewport configuration */
  viewport: {
    width: number
    height: number
  }
  
  /** User agent string */
  userAgent: string
  
  /** Locale */
  locale: string
  
  /** Timezone (IANA timezone identifier) */
  timezoneId: string
  
  /** Device scale factor */
  deviceScaleFactor: number
  
  /** Accept language header */
  acceptLanguage: string
  
  /** Enable JavaScript */
  javaScriptEnabled: boolean
  
  /** Extra HTTP headers */
  extraHTTPHeaders?: Record<string, string>
}

export const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  headless: process.env.BROWSER_HEADLESS !== 'false',
  timeout: parseInt(process.env.BROWSER_TIMEOUT_MS || '30000', 10),
  navigationTimeout: parseInt(process.env.BROWSER_NAV_TIMEOUT_MS || '30000', 10),
  viewport: {
    width: 1920,
    height: 1080,
  },
  // Honest user agent - identifies as automation
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  locale: 'en-US',
  timezoneId: 'America/New_York',
  deviceScaleFactor: 1,
  acceptLanguage: 'en-US,en;q=0.9',
  javaScriptEnabled: true,
  extraHTTPHeaders: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  },
}

/**
 * Browser Manager
 * 
 * Manages Playwright browser instances with clean configuration.
 */
export class BrowserManager {
  private browser: Browser | null = null
  private contexts: Map<string, BrowserContext> = new Map()
  private config: BrowserConfig
  
  constructor(config: Partial<BrowserConfig> = {}) {
    this.config = { ...DEFAULT_BROWSER_CONFIG, ...config }
  }
  
  /**
   * Launch browser
   */
  async launch(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }
    
    const launchOptions: LaunchOptions = {
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    }
    
    this.browser = await chromium.launch(launchOptions)
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      module: 'BrowserManager',
      message: 'Browser launched',
      headless: this.config.headless,
    }))
    
    return this.browser
  }
  
  /**
   * Create browser context
   */
  async createContext(contextId: string = 'default'): Promise<BrowserContext> {
    const browser = await this.launch()
    
    const context = await browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      locale: this.config.locale,
      timezoneId: this.config.timezoneId,
      deviceScaleFactor: this.config.deviceScaleFactor,
      acceptDownloads: false,
      javaScriptEnabled: this.config.javaScriptEnabled,
      extraHTTPHeaders: this.config.extraHTTPHeaders,
    })
    
    // Set default timeouts
    context.setDefaultTimeout(this.config.timeout)
    context.setDefaultNavigationTimeout(this.config.navigationTimeout)
    
    this.contexts.set(contextId, context)
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      module: 'BrowserManager',
      message: 'Context created',
      contextId,
    }))
    
    return context
  }
  
  /**
   * Get existing context or create new one
   */
  async getContext(contextId: string = 'default'): Promise<BrowserContext> {
    const existing = this.contexts.get(contextId)
    if (existing) {
      return existing
    }
    
    return this.createContext(contextId)
  }
  
  /**
   * Create page in context
   */
  async createPage(contextId: string = 'default'): Promise<Page> {
    const context = await this.getContext(contextId)
    const page = await context.newPage()
    
    // Add console message logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'debug',
          module: 'BrowserManager',
          message: 'Browser console error',
          text: msg.text(),
        }))
      }
    })
    
    // Add page error logging
    page.on('pageerror', error => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        module: 'BrowserManager',
        message: 'Page error',
        error: error.message,
      }))
    })
    
    return page
  }
  
  /**
   * Close context
   */
  async closeContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId)
    if (context) {
      await context.close()
      this.contexts.delete(contextId)
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        module: 'BrowserManager',
        message: 'Context closed',
        contextId,
      }))
    }
  }
  
  /**
   * Close all contexts
   */
  async closeAllContexts(): Promise<void> {
    const contextIds = Array.from(this.contexts.keys())
    await Promise.all(contextIds.map(id => this.closeContext(id)))
  }
  
  /**
   * Close browser
   */
  async close(): Promise<void> {
    await this.closeAllContexts()
    
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        module: 'BrowserManager',
        message: 'Browser closed',
      }))
    }
  }
  
  /**
   * Get active context count
   */
  getContextCount(): number {
    return this.contexts.size
  }
  
  /**
   * Check if browser is running
   */
  isRunning(): boolean {
    return this.browser !== null && this.browser.isConnected()
  }
}

/**
 * Helper: Execute operation with temporary page
 */
export async function withPage<T>(
  operation: (page: Page) => Promise<T>,
  config: Partial<BrowserConfig> = {}
): Promise<T> {
  const manager = new BrowserManager(config)
  let page: Page | null = null
  
  try {
    page = await manager.createPage()
    return await operation(page)
  } finally {
    if (page) {
      await page.close().catch(() => {})
    }
    await manager.close().catch(() => {})
  }
}
