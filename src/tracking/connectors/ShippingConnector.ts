/**
 * Shipping Connector Interface
 * 
 * All shipping company integrations must implement this interface.
 * Connectors are responsible for:
 * - Validating container numbers for their carrier
 * - Fetching tracking data via official APIs, EDI, or authorized scraping
 * - Normalizing data into TrackingResult format
 * - Reporting health status
 * 
 * Connectors should NOT:
 * - Implement retry logic (handled by RetryManager)
 * - Manipulate browser fingerprints (use legitimate configuration)
 * - Bypass access controls (report ACCESS_DENIED instead)
 */

import type { TrackingOperationResult, ContainerValidation } from '../models/TrackingResult.js'

export interface ConnectorConfig {
  /** Provider identifier (e.g., 'maersk', 'msc') */
  provider: string
  
  /** Connector name for logging */
  name: string
  
  /** API configuration */
  api?: {
    baseUrl: string
    apiKey?: string
    apiSecret?: string
    rateLimit?: {
      requestsPerSecond: number
      requestsPerMinute: number
    }
  }
  
  /** EDI configuration */
  edi?: {
    endpoint: string
    username?: string
    password?: string
  }
  
  /** Scraping configuration (only when no API available) */
  scraping?: {
    baseUrl: string
    trackingUrl: string
    timeout: number
    requiresAuth: boolean
  }
  
  /** Health check configuration */
  healthCheck?: {
    enabled: boolean
    url: string
    intervalMs: number
  }
}

export interface HealthCheckResult {
  healthy: boolean
  responseTimeMs?: number
  lastCheck: Date
  message?: string
  details?: {
    apiAvailable?: boolean
    websiteAvailable?: boolean
    authenticationValid?: boolean
  }
}

/**
 * Base interface for all shipping connectors
 */
export interface ShippingConnector {
  /** Provider identifier */
  provider: string
  
  /** Connector configuration */
  config: ConnectorConfig
  
  /**
   * Validate container number format for this carrier
   * 
   * Should check:
   * - ISO 6346 format
   * - Owner code matches carrier
   * - Check digit is valid
   * 
   * @param containerNumber - Normalized container number (e.g., 'MAEU1234567')
   * @returns Validation result
   */
  validateContainerNumber(containerNumber: string): ContainerValidation
  
  /**
   * Track a container
   * 
   * This is the main method that fetches tracking data.
   * Should use official API if available, otherwise authorized scraping.
   * 
   * Must NOT:
   * - Retry on failure (RetryManager handles this)
   * - Hide errors (return explicit error in result)
   * - Bypass access controls
   * 
   * @param containerNumber - Validated container number
   * @returns Tracking result or error
   */
  track(containerNumber: string): Promise<TrackingOperationResult>
  
  /**
   * Perform health check
   * 
   * Should verify:
   * - API endpoint is reachable
   * - Website is available
   * - Authentication is valid
   * - Rate limits are not exceeded
   * 
   * @returns Health check result
   */
  healthCheck(): Promise<HealthCheckResult>
  
  /**
   * Get connector metadata
   * 
   * @returns Connector information
   */
  getMetadata(): {
    provider: string
    name: string
    version: string
    dataSource: 'api' | 'edi' | 'scrape' | 'external_provider'
    capabilities: {
      realtime: boolean
      historicalEvents: boolean
      vesselTracking: boolean
      estimatedArrival: boolean
    }
  }
}

/**
 * Base connector class with common functionality
 */
export abstract class BaseShippingConnector implements ShippingConnector {
  public readonly provider: string
  public readonly config: ConnectorConfig
  
  constructor(config: ConnectorConfig) {
    this.provider = config.provider
    this.config = config
  }
  
  abstract validateContainerNumber(containerNumber: string): ContainerValidation
  abstract track(containerNumber: string): Promise<TrackingOperationResult>
  abstract healthCheck(): Promise<HealthCheckResult>
  abstract getMetadata(): ReturnType<ShippingConnector['getMetadata']>
  
  /**
   * Helper: Validate ISO 6346 format
   */
  protected validateISO6346Format(containerNumber: string): boolean {
    return /^[A-Z]{3}[UJZ]\d{7}$/.test(containerNumber)
  }
  
  /**
   * Helper: Validate ISO 6346 check digit
   */
  protected validateISO6346CheckDigit(containerNumber: string): boolean {
    if (!this.validateISO6346Format(containerNumber)) return false
    
    const letterValues: Record<string, number> = {
      A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19,
      J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29,
      S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
    }
    
    let sum = 0
    for (let i = 0; i < 10; i++) {
      const char = containerNumber[i]
      const value = i < 4 ? letterValues[char] : Number(char)
      sum += value * Math.pow(2, i)
    }
    
    const remainder = sum % 11
    const checkDigit = remainder === 10 ? 0 : remainder
    return checkDigit === Number(containerNumber[10])
  }
  
  /**
   * Helper: Check if container owner code matches carrier
   */
  protected ownerCodeMatches(containerNumber: string, validCodes: string[]): boolean {
    const ownerCode = containerNumber.substring(0, 4)
    return validCodes.includes(ownerCode)
  }
  
  /**
   * Helper: Log operation
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      provider: this.provider,
      message,
      ...context,
    }
    console.log(JSON.stringify(log))
  }
}
