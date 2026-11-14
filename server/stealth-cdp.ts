import type { Page, BrowserContext, CDPSession } from 'playwright-core'

/**
 * Apply ultra-aggressive stealth patches via Chrome DevTools Protocol (CDP)
 * This bypasses Cloudflare, DataDome, PerimeterX, and other advanced bot detection
 */
export async function applyCdpStealth(context: BrowserContext): Promise<void> {
  // Apply to all pages in context
  context.on('page', async (page) => {
    await patchPageCdp(page)
  })
}

async function patchPageCdp(page: Page): Promise<void> {
  try {
    const client = await page.context().newCDPSession(page)
    
    // 1. Patch navigator.webdriver via CDP
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        // Delete webdriver completely
        delete Object.getPrototypeOf(navigator).webdriver;
        delete navigator.webdriver;
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true
        });
        
        // Patch automation-related properties
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters)
        );
        
        // Override plugins with realistic data
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = [
              {
                0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: Plugin.prototype },
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
              },
            ];
            return Object.setPrototypeOf(plugins, PluginArray.prototype);
          },
        });
        
        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        // Chrome runtime
        if (!window.chrome) {
          window.chrome = {};
        }
        
        window.chrome.runtime = {
          connect: () => ({}),
          sendMessage: () => ({}),
        };
        
        window.chrome.loadTimes = function() {
          return {
            requestTime: performance.timing.navigationStart / 1000,
            startLoadTime: performance.timing.navigationStart / 1000,
            commitLoadTime: performance.timing.responseStart / 1000,
            finishDocumentLoadTime: performance.timing.domContentLoadedEventEnd / 1000,
            finishLoadTime: performance.timing.loadEventEnd / 1000,
            firstPaintTime: performance.timing.loadEventEnd / 1000,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasFetchedViaSpdy: false,
            wasNpnNegotiated: true,
            npnNegotiatedProtocol: 'h2',
            wasAlternateProtocolAvailable: false,
            connectionInfo: 'h2',
          };
        };
        
        window.chrome.csi = function() {
          return {
            startE: performance.timing.navigationStart,
            onloadT: performance.timing.loadEventEnd,
            pageT: Date.now() - performance.timing.navigationStart,
            tran: 15,
          };
        };
        
        window.chrome.app = {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        };
        
        // WebGL vendor spoofing
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return 'Intel Inc.';
          if (parameter === 37446) return 'Intel Iris OpenGL Engine';
          return getParameter.call(this, parameter);
        };
        
        if (typeof WebGL2RenderingContext !== 'undefined') {
          const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.';
            if (parameter === 37446) return 'Intel Iris OpenGL Engine';
            return getParameter2.call(this, parameter);
          };
        }
        
        // Canvas fingerprint noise
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalToBlob = HTMLCanvasElement.prototype.toBlob;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        
        const addNoise = (imageData) => {
          const data = imageData.data;
          const noise = () => Math.floor(Math.random() * 5) - 2;
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.max(0, Math.min(255, data[i] + noise()));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise()));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise()));
          }
          return imageData;
        };
        
        CanvasRenderingContext2D.prototype.getImageData = function(...args) {
          const imageData = originalGetImageData.apply(this, args);
          return addNoise(imageData);
        };
        
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
          if (this.width > 0 && this.height > 0) {
            const context = this.getContext('2d');
            if (context) {
              const imageData = context.getImageData(0, 0, this.width, this.height);
              addNoise(imageData);
              context.putImageData(imageData, 0, 0);
            }
          }
          return originalToDataURL.apply(this, args);
        };
        
        HTMLCanvasElement.prototype.toBlob = function(...args) {
          if (this.width > 0 && this.height > 0) {
            const context = this.getContext('2d');
            if (context) {
              const imageData = context.getImageData(0, 0, this.width, this.height);
              addNoise(imageData);
              context.putImageData(imageData, 0, 0);
            }
          }
          return originalToBlob.apply(this, args);
        };
        
        // AudioContext fingerprint
        if (typeof AudioContext !== 'undefined') {
          const OriginalAudioContext = AudioContext;
          AudioContext = function() {
            const context = new OriginalAudioContext();
            const originalCreateOscillator = context.createOscillator.bind(context);
            context.createOscillator = function() {
              const oscillator = originalCreateOscillator();
              const originalStart = oscillator.start.bind(oscillator);
              oscillator.start = function(when) {
                when = when || 0;
                when += Math.random() * 0.0001;
                return originalStart(when);
              };
              return oscillator;
            };
            return context;
          };
          AudioContext.prototype = OriginalAudioContext.prototype;
        }
        
        // Battery API
        if (navigator.getBattery) {
          const originalGetBattery = navigator.getBattery.bind(navigator);
          navigator.getBattery = async () => {
            const battery = await originalGetBattery();
            Object.defineProperty(battery, 'charging', { value: true });
            Object.defineProperty(battery, 'chargingTime', { value: 0 });
            Object.defineProperty(battery, 'dischargingTime', { value: Infinity });
            Object.defineProperty(battery, 'level', { value: 1 });
            return battery;
          };
        }
        
        // Connection API
        if (navigator.connection) {
          Object.defineProperty(navigator.connection, 'rtt', { value: 100, writable: false });
          Object.defineProperty(navigator.connection, 'downlink', { value: 10, writable: false });
          Object.defineProperty(navigator.connection, 'effectiveType', { value: '4g', writable: false });
          Object.defineProperty(navigator.connection, 'saveData', { value: false, writable: false });
        }
        
        // Screen properties
        Object.defineProperty(screen, 'availWidth', { get: () => screen.width });
        Object.defineProperty(screen, 'availHeight', { get: () => screen.height });
        Object.defineProperty(screen, 'availTop', { get: () => 0 });
        Object.defineProperty(screen, 'availLeft', { get: () => 0 });
        
        // Hardware concurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        
        // Remove automation console messages
        const originalConsoleDebug = console.debug;
        console.debug = function(...args) {
          if (args[0] && typeof args[0] === 'string' && args[0].includes('DevTools')) return;
          return originalConsoleDebug.apply(console, args);
        };
        
        // Notification permission
        if (Notification) {
          const originalPermission = Notification.permission;
          Object.defineProperty(Notification, 'permission', {
            get: () => 'default',
          });
        }
        
        // Remove CDP runtime markers
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      `,
    })
    
    // 2. Disable automation features via CDP
    await client.send('Network.setUserAgentOverride', {
      userAgent: await page.evaluate(() => navigator.userAgent),
      acceptLanguage: 'en-US,en;q=0.9',
      platform: 'Win32',
    })
    
    // 3. Spoof timezone
    await client.send('Emulation.setTimezoneOverride', {
      timezoneId: 'America/New_York',
    })
    
    // 4. Spoof geolocation
    await client.send('Emulation.setGeolocationOverride', {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 100,
    })
    
    // 5. Enable various stealth settings
    await client.send('Page.setBypassCSP', { enabled: true })
    
    await client.detach()
  } catch (error) {
    console.error('CDP stealth patch failed:', error)
  }
}
