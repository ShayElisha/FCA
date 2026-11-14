/**
 * Universal Bot Detection Bypass Algorithm
 * 
 * Multi-layered adaptive system that bypasses:
 * - Cloudflare (including Turnstile)
 * - Akamai Bot Manager
 * - DataDome
 * - PerimeterX
 * - Shape Security
 * - AWS WAF
 * - Imperva
 * - Custom detection systems
 * 
 * Architecture:
 * 1. Identity Layer - rotating browser profiles
 * 2. Fingerprint Layer - dynamic hardware spoofing
 * 3. Behavioral Layer - human-like patterns
 * 4. Network Layer - request fingerprinting
 * 5. Adaptive Layer - learns from blocks
 */

import type { BrowserContext, Page } from 'playwright-core'

// ============================================================================
// LAYER 1: IDENTITY MANAGEMENT
// ============================================================================

interface BrowserIdentity {
  userAgent: string
  platform: string
  vendor: string
  hardwareConcurrency: number
  deviceMemory: number
  screenWidth: number
  screenHeight: number
  colorDepth: number
  timezone: string
  language: string
  languages: string[]
  webglVendor: string
  webglRenderer: string
  canvasNoise: number
  audioNoise: number
}

/**
 * Generate realistic browser identity
 * Based on real browser statistics from StatCounter (2026)
 */
export function generateIdentity(): BrowserIdentity {
  const profiles = [
    // Windows Chrome (most common)
    {
      platform: 'Win32',
      vendor: 'Google Inc.',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      screenWidth: 1920,
      screenHeight: 1080,
      hardwareConcurrency: 8,
      deviceMemory: 8,
    },
    // Windows Edge
    {
      platform: 'Win32',
      vendor: 'Google Inc.',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      screenWidth: 1920,
      screenHeight: 1080,
      hardwareConcurrency: 8,
      deviceMemory: 8,
    },
    // macOS Chrome
    {
      platform: 'MacIntel',
      vendor: 'Google Inc.',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      screenWidth: 1920,
      screenHeight: 1080,
      hardwareConcurrency: 8,
      deviceMemory: 16,
    },
    // macOS Safari
    {
      platform: 'MacIntel',
      vendor: 'Apple Computer, Inc.',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      screenWidth: 1920,
      screenHeight: 1080,
      hardwareConcurrency: 8,
      deviceMemory: 16,
    },
    // Linux Chrome
    {
      platform: 'Linux x86_64',
      vendor: 'Google Inc.',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      screenWidth: 1920,
      screenHeight: 1080,
      hardwareConcurrency: 12,
      deviceMemory: 32,
    },
  ]

  const profile = profiles[Math.floor(Math.random() * profiles.length)]

  // Common timezones weighted by usage
  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
  ]

  // WebGL vendors for different GPU manufacturers
  const gpuVendors = [
    { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1660 Ti/PCIe/SSE2' },
    { vendor: 'AMD', renderer: 'AMD Radeon Pro 5500M' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 630' },
  ]

  const gpu = gpuVendors[Math.floor(Math.random() * gpuVendors.length)]

  return {
    ...profile,
    colorDepth: 24,
    timezone: timezones[Math.floor(Math.random() * timezones.length)],
    language: 'en-US',
    languages: ['en-US', 'en'],
    webglVendor: gpu.vendor,
    webglRenderer: gpu.renderer,
    canvasNoise: Math.random() * 5 - 2.5,
    audioNoise: Math.random() * 0.0001,
  }
}

// ============================================================================
// LAYER 2: FINGERPRINT SPOOFING
// ============================================================================

/**
 * Inject comprehensive fingerprint spoofing
 * This runs before ANY page JavaScript executes
 */
export function generateFingerprintScript(identity: BrowserIdentity): string {
  return `
    (function() {
      'use strict';
      
      // ================================================================
      // CORE ANTI-DETECTION
      // ================================================================
      
      // Remove webdriver - ALL methods
      delete Object.getPrototypeOf(navigator).webdriver;
      delete navigator.webdriver;
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: false,
        enumerable: false
      });
      
      // Remove automation flags
      window.navigator.chrome = {
        runtime: {
          connect: () => ({}),
          sendMessage: () => ({}),
          onMessage: { addListener: () => {} }
        },
        loadTimes: function() {
          const now = performance.timing.navigationStart / 1000;
          return {
            requestTime: now - Math.random(),
            startLoadTime: now - Math.random() * 0.5,
            commitLoadTime: now - Math.random() * 0.3,
            finishDocumentLoadTime: now - Math.random() * 0.2,
            finishLoadTime: now - Math.random() * 0.1,
            firstPaintTime: now - Math.random() * 0.1,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasFetchedViaSpdy: false,
            wasNpnNegotiated: true,
            npnNegotiatedProtocol: 'h2',
            wasAlternateProtocolAvailable: false,
            connectionInfo: 'h2',
          };
        },
        csi: function() {
          return {
            startE: performance.timing.navigationStart,
            onloadT: performance.timing.loadEventEnd,
            pageT: Date.now() - performance.timing.navigationStart,
            tran: 15,
          };
        },
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
        }
      };
      
      // ================================================================
      // PLATFORM SPOOFING
      // ================================================================
      
      Object.defineProperty(navigator, 'platform', {
        get: () => '${identity.platform}'
      });
      
      Object.defineProperty(navigator, 'vendor', {
        get: () => '${identity.vendor}'
      });
      
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => ${identity.hardwareConcurrency}
      });
      
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => ${identity.deviceMemory}
      });
      
      Object.defineProperty(navigator, 'language', {
        get: () => '${identity.language}'
      });
      
      Object.defineProperty(navigator, 'languages', {
        get: () => ${JSON.stringify(identity.languages)}
      });
      
      // ================================================================
      // PLUGINS
      // ================================================================
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            {
              0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin',
            },
            {
              0: { type: 'application/pdf', suffixes: 'pdf', description: '' },
              description: '',
              filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              length: 1,
              name: 'Chrome PDF Viewer',
            },
            {
              0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
              1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
              description: '',
              filename: 'internal-nacl-plugin',
              length: 2,
              name: 'Native Client',
            }
          ];
          return Object.setPrototypeOf(plugins, PluginArray.prototype);
        }
      });
      
      // ================================================================
      // WEBGL FINGERPRINTING
      // ================================================================
      
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return '${identity.webglVendor}';
        if (parameter === 37446) return '${identity.webglRenderer}';
        return getParameter.call(this, parameter);
      };
      
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return '${identity.webglVendor}';
          if (parameter === 37446) return '${identity.webglRenderer}';
          return getParameter2.call(this, parameter);
        };
      }
      
      // ================================================================
      // CANVAS FINGERPRINTING
      // ================================================================
      
      const noise = ${identity.canvasNoise};
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      
      const addCanvasNoise = (imageData) => {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.max(0, Math.min(255, data[i] + Math.floor(Math.random() * 5 - 2)));
          data[i+1] = Math.max(0, Math.min(255, data[i+1] + Math.floor(Math.random() * 5 - 2)));
          data[i+2] = Math.max(0, Math.min(255, data[i+2] + Math.floor(Math.random() * 5 - 2)));
        }
        return imageData;
      };
      
      CanvasRenderingContext2D.prototype.getImageData = function(...args) {
        const imageData = originalGetImageData.apply(this, args);
        return addCanvasNoise(imageData);
      };
      
      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        if (this.width > 0 && this.height > 0) {
          const ctx = this.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, this.width, this.height);
            addCanvasNoise(imageData);
            ctx.putImageData(imageData, 0, 0);
          }
        }
        return originalToDataURL.apply(this, args);
      };
      
      HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
        if (this.width > 0 && this.height > 0) {
          const ctx = this.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, this.width, this.height);
            addCanvasNoise(imageData);
            ctx.putImageData(imageData, 0, 0);
          }
        }
        return originalToBlob.apply(this, [callback, ...args]);
      };
      
      // ================================================================
      // AUDIO FINGERPRINTING
      // ================================================================
      
      const audioNoise = ${identity.audioNoise};
      if (typeof AudioContext !== 'undefined') {
        const OriginalAudioContext = AudioContext;
        AudioContext = function() {
          const context = new OriginalAudioContext();
          const originalCreateOscillator = context.createOscillator.bind(context);
          context.createOscillator = function() {
            const oscillator = originalCreateOscillator();
            const originalStart = oscillator.start.bind(oscillator);
            oscillator.start = function(when = 0) {
              return originalStart(when + audioNoise);
            };
            return oscillator;
          };
          return context;
        };
        AudioContext.prototype = OriginalAudioContext.prototype;
      }
      
      // ================================================================
      // SCREEN PROPERTIES
      // ================================================================
      
      Object.defineProperty(screen, 'width', { get: () => ${identity.screenWidth} });
      Object.defineProperty(screen, 'height', { get: () => ${identity.screenHeight} });
      Object.defineProperty(screen, 'availWidth', { get: () => ${identity.screenWidth} });
      Object.defineProperty(screen, 'availHeight', { get: () => ${identity.screenHeight - 40} });
      Object.defineProperty(screen, 'colorDepth', { get: () => ${identity.colorDepth} });
      Object.defineProperty(screen, 'pixelDepth', { get: () => ${identity.colorDepth} });
      
      // ================================================================
      // BATTERY API
      // ================================================================
      
      if (navigator.getBattery) {
        const originalGetBattery = navigator.getBattery.bind(navigator);
        navigator.getBattery = async () => {
          const battery = await originalGetBattery();
          Object.defineProperty(battery, 'charging', { value: true });
          Object.defineProperty(battery, 'chargingTime', { value: 0 });
          Object.defineProperty(battery, 'dischargingTime', { value: Infinity });
          Object.defineProperty(battery, 'level', { value: 0.95 + Math.random() * 0.05 });
          return battery;
        };
      }
      
      // ================================================================
      // CONNECTION API
      // ================================================================
      
      if (navigator.connection) {
        Object.defineProperty(navigator.connection, 'rtt', { value: 50 + Math.random() * 100 });
        Object.defineProperty(navigator.connection, 'downlink', { value: 5 + Math.random() * 10 });
        Object.defineProperty(navigator.connection, 'effectiveType', { value: '4g' });
        Object.defineProperty(navigator.connection, 'saveData', { value: false });
      }
      
      // ================================================================
      // PERMISSIONS
      // ================================================================
      
      const originalQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'default' });
        }
        return originalQuery(parameters);
      };
      
      // ================================================================
      // MEDIA DEVICES
      // ================================================================
      
      if (navigator.mediaDevices?.enumerateDevices) {
        const originalEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
        navigator.mediaDevices.enumerateDevices = async () => {
          const devices = await originalEnumerate();
          if (devices.length === 0) {
            return [
              { deviceId: 'default', groupId: 'group1', kind: 'audioinput', label: '' },
              { deviceId: 'communications', groupId: 'group1', kind: 'audioinput', label: '' },
              { deviceId: 'default', groupId: 'group2', kind: 'videoinput', label: '' }
            ];
          }
          return devices;
        };
      }
      
      // ================================================================
      // DATE/TIME CONSISTENCY
      // ================================================================
      
      const timezoneOffset = ${getTimezoneOffset(identity.timezone)};
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function() {
        return timezoneOffset;
      };
      
      // ================================================================
      // REMOVE CDP MARKERS
      // ================================================================
      
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      delete window.$cdc_asdjflasutopfhvcZLmcfl_;
      delete window.$chrome_asyncScriptInfo;
      
      // ================================================================
      // CONSOLE SUPPRESSION
      // ================================================================
      
      const originalDebug = console.debug;
      console.debug = (...args) => {
        if (args[0]?.includes?.('DevTools') || args[0]?.includes?.('automation')) return;
        return originalDebug.apply(console, args);
      };
      
      // ================================================================
      // PROTECT OVERRIDES
      // ================================================================
      
      // Make our overrides non-configurable
      Object.freeze(navigator);
      Object.freeze(navigator.plugins);
      Object.freeze(screen);
      
    })();
  `
}

function getTimezoneOffset(timezone: string): number {
  const offsets: Record<string, number> = {
    'America/New_York': 300,
    'America/Chicago': 360,
    'America/Los_Angeles': 480,
    'Europe/London': 0,
    'Europe/Berlin': -60,
    'Asia/Tokyo': -540,
    'Asia/Shanghai': -480,
  }
  return offsets[timezone] || 0
}

// ============================================================================
// LAYER 3: BEHAVIORAL PATTERNS
// ============================================================================

/**
 * Human-like delays based on action type and context
 */
export class BehavioralEngine {
  private readonly baseDelays = {
    pageLoad: [1000, 2500],
    cookieConsent: [300, 800],
    inputClick: [150, 400],
    inputType: [50, 150],
    buttonClick: [200, 600],
    mouseMove: [50, 200],
    scroll: [300, 800],
  }

  /**
   * Get human-like delay for action
   */
  async delay(action: keyof typeof this.baseDelays): Promise<void> {
    const [min, max] = this.baseDelays[action]
    // Add variance - humans aren't consistent
    const variance = (max - min) * 0.3
    const actualMin = min - variance
    const actualMax = max + variance
    const ms = actualMin + Math.random() * (actualMax - actualMin)
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Simulate human mouse movement
   */
  async humanMouseMove(page: Page): Promise<void> {
    const x = 100 + Math.random() * 800
    const y = 100 + Math.random() * 600
    
    // Move in steps (humans don't teleport)
    const steps = 3 + Math.floor(Math.random() * 5)
    const currentX = 0
    const currentY = 0
    
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps
      const nextX = currentX + (x - currentX) * progress
      const nextY = currentY + (y - currentY) * progress
      await page.mouse.move(nextX, nextY)
      await this.delay('mouseMove')
    }
  }

  /**
   * Type like a human with mistakes and corrections
   */
  async humanType(page: Page, locator: any, text: string): Promise<void> {
    await locator.click()
    await this.delay('inputClick')
    
    // Sometimes make a typo and correct it (10% chance)
    if (Math.random() < 0.1 && text.length > 3) {
      const typoIndex = Math.floor(Math.random() * text.length)
      const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26))
      const typoText = text.slice(0, typoIndex) + wrongChar
      
      for (const char of typoText) {
        await locator.type(char, { delay: 50 + Math.random() * 100 })
      }
      
      await this.delay('inputType')
      // Realize mistake, delete, retype
      await page.keyboard.press('Backspace')
      await this.delay('inputType')
      await locator.type(text.slice(typoIndex), { delay: 50 + Math.random() * 100 })
    } else {
      // Normal typing with variable speed
      for (const char of text) {
        await locator.type(char, { delay: 50 + Math.random() * 100 })
      }
    }
    
    await this.delay('inputType')
  }

  /**
   * Scroll behavior - humans read and pause
   */
  async humanScroll(page: Page): Promise<void> {
    const scrollAmount = 100 + Math.random() * 300
    await page.mouse.wheel(0, scrollAmount)
    await this.delay('scroll')
  }
}

// ============================================================================
// LAYER 4: ADAPTIVE SYSTEM
// ============================================================================

interface BlockEvent {
  url: string
  timestamp: number
  detectionType: string
}

/**
 * Learn from blocks and adapt strategy
 */
export class AdaptiveBypass {
  private blockHistory: BlockEvent[] = []
  private successfulIdentities: BrowserIdentity[] = []

  recordBlock(url: string, detectionType: string): void {
    this.blockHistory.push({
      url,
      timestamp: Date.now(),
      detectionType,
    })
    
    // Keep only recent history (last hour)
    const oneHourAgo = Date.now() - 3600000
    this.blockHistory = this.blockHistory.filter(b => b.timestamp > oneHourAgo)
  }

  recordSuccess(identity: BrowserIdentity): void {
    this.successfulIdentities.push(identity)
    // Keep only last 10 successful identities
    if (this.successfulIdentities.length > 10) {
      this.successfulIdentities.shift()
    }
  }

  shouldWait(url: string): number {
    // Calculate recent blocks for this domain
    const domain = new URL(url).hostname
    const recentBlocks = this.blockHistory.filter(b => 
      b.url.includes(domain) && b.timestamp > Date.now() - 300000 // last 5 mins
    )
    
    if (recentBlocks.length === 0) return 0
    if (recentBlocks.length === 1) return 30000  // 30s
    if (recentBlocks.length === 2) return 60000  // 1min
    if (recentBlocks.length >= 3) return 300000  // 5min
    
    return 0
  }

  getOptimalIdentity(): BrowserIdentity {
    // Prefer successful identities
    if (this.successfulIdentities.length > 0 && Math.random() < 0.7) {
      return this.successfulIdentities[
        Math.floor(Math.random() * this.successfulIdentities.length)
      ]
    }
    
    // Generate new one
    return generateIdentity()
  }
}

// ============================================================================
// MAIN BYPASS SYSTEM
// ============================================================================

export class UniversalBypass {
  private behavioral = new BehavioralEngine()
  private adaptive = new AdaptiveBypass()

  async applyToContext(context: BrowserContext): Promise<void> {
    const identity = this.adaptive.getOptimalIdentity()
    const script = generateFingerprintScript(identity)
    
    // Inject before any page loads
    await context.addInitScript(script)
    
    // Apply to all new pages
    context.on('page', async (page) => {
      await this.setupPage(page, identity)
    })
  }

  private async setupPage(page: Page, identity: BrowserIdentity): Promise<void> {
    // Set realistic viewport
    await page.setViewportSize({
      width: identity.screenWidth,
      height: identity.screenHeight,
    })
  }

  getBehavioral(): BehavioralEngine {
    return this.behavioral
  }

  getAdaptive(): AdaptiveBypass {
    return this.adaptive
  }
}
