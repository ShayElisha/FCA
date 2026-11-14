/**
 * Maersk Line Connector
 * 
 * Data Source: Official Maersk Track & Trace API
 * Status: Requires API credentials (Consumer Key + Client Secret)
 * 
 * Maersk provides an official OAuth 2.0 authenticated API for container tracking.
 * This connector uses the Track & Trace Plus API for reliable, real-time tracking data.
 * 
 * Setup:
 * 1. Register at https://developer.maersk.com/
 * 2. Create an app
 * 3. Subscribe to "Track & Trace Plus" API
 * 4. Get Consumer Key and Client Secret
 * 5. Set environment variables:
 *    MAERSK_CONSUMER_KEY=your_consumer_key
 *    MAERSK_CLIENT_SECRET=your_client_secret
 * 
 * API Documentation:
 * https://developer.maersk.com/api-catalogue/Track%20and%20Trace%20Plus
 * 
 * Benefits over scraping:
 * - Officially supported and stable
 * - Real-time data
 * - No anti-bot challenges
 * - Better data quality
 * - Terms of service compliant
 */

import { BaseShippingConnector, type HealthCheckResult } from './ShippingConnector.js'
import type { TrackingOperationResult, ContainerValidation, TrackingResult, TrackingEvent } from '../models/TrackingResult.js'
import { ErrorCode, ErrorCategory } from '../models/TrackingResult.js'
import { BlockAnalyzer } from '../diagnostics/BlockAnalyzer.js'

/**
 * Maersk owner codes
 * Source: ISO 6346 container prefix registry
 */
const MAERSK_OWNER_CODES = [
  'MAEU', // Maersk Line
  'MAER', // Maersk Line (alternative)
  'SEJJ', // SeaLand (Maersk subsidiary)
  'MCPU', // MCC Transport (Maersk subsidiary)
  'MAGU', // Maersk Line
  'MSCU', // Hamburg Süd (Maersk subsidiary - some codes)
]

interface MaerskAuthToken {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
}

interface MaerskShipmentEvent {
  eventType: string
  eventDateTime: string
  eventTypeCode: string
  transportCall?: {
    location?: {
      locationName?: string
      UNLocationCode?: string
    }
    vessel?: {
      vesselName?: string
      vesselIMONumber?: string
    }
    transportCallNumber?: string
  }
  emptyIndicatorCode?: string
}

interface MaerskContainerResponse {
  carrierBookingReference?: string
  equipmentReference: string
  events: MaerskShipmentEvent[]
}

export class MaerskConnector extends BaseShippingConnector {
  private tokenCache: MaerskAuthToken | null = null
  private readonly consumerKey: string
  private readonly clientSecret: string
  private readonly baseUrl = 'https://api.maersk.com'
  private readonly tokenUrl = 'https://api.maersk.com/customer-identity/oauth/v2/access_token'
  
  constructor() {
    const consumerKey = process.env.MAERSK_CONSUMER_KEY
    const clientSecret = process.env.MAERSK_CLIENT_SECRET
    
    if (!consumerKey || !clientSecret) {
      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        module: 'MaerskConnector',
        message: 'Maersk API credentials not configured',
        recommendation: 'Set MAERSK_CONSUMER_KEY and MAERSK_CLIENT_SECRET environment variables',
      }))
    }
    
    super({
      provider: 'maersk',
      name: 'Maersk Line Track & Trace',
      api: {
        baseUrl: 'https://api.maersk.com',
        apiKey: consumerKey,
        apiSecret: clientSecret,
        rateLimit: {
          requestsPerSecond: 10,
          requestsPerMinute: 600,
        },
      },
      healthCheck: {
        enabled: true,
        url: 'https://api.maersk.com',
        intervalMs: 60000,
      },
    })
    
    this.consumerKey = consumerKey || ''
    this.clientSecret = clientSecret || ''
  }
  
  validateContainerNumber(containerNumber: string): ContainerValidation {
    // Check ISO 6346 format
    if (!this.validateISO6346Format(containerNumber)) {
      return {
        valid: false,
        error: 'Container number does not match ISO 6346 format',
      }
    }
    
    // Check check digit
    if (!this.validateISO6346CheckDigit(containerNumber)) {
      return {
        valid: false,
        error: 'Invalid check digit',
      }
    }
    
    // Check owner code
    if (!this.ownerCodeMatches(containerNumber, MAERSK_OWNER_CODES)) {
      return {
        valid: false,
        error: `Container owner code does not belong to Maersk. Expected: ${MAERSK_OWNER_CODES.join(', ')}`,
      }
    }
    
    return {
      valid: true,
      containerNumber,
    }
  }
  
  async track(containerNumber: string): Promise<TrackingOperationResult> {
    const requestId = this.generateRequestId()
    
    try {
      this.log('info', 'Starting tracking operation', {
        containerNumber,
        requestId,
        method: 'api',
      })
      
      // Validate first
      const validation = this.validateContainerNumber(containerNumber)
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: ErrorCode.INVALID_CONTAINER_NUMBER,
            category: ErrorCategory.VALIDATION,
            provider: this.provider,
            timestamp: new Date().toISOString(),
            requestId,
            retryable: false,
            message: validation.error || 'Invalid container number',
          },
        }
      }
      
      // Check credentials
      if (!this.consumerKey || !this.clientSecret) {
        return {
          success: false,
          error: {
            code: ErrorCode.MISSING_CREDENTIALS,
            category: ErrorCategory.CONFIGURATION,
            provider: this.provider,
            timestamp: new Date().toISOString(),
            requestId,
            retryable: false,
            message: 'Maersk API credentials not configured',
            recommendation: 'Set MAERSK_CONSUMER_KEY and MAERSK_CLIENT_SECRET environment variables. Register at https://developer.maersk.com/',
          },
        }
      }
      
      // Get authentication token
      const token = await this.getAccessToken()
      
      // Call Maersk Track & Trace API
      const url = `${this.baseUrl}/track-and-trace-private/events?equipmentReference=${containerNumber}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Consumer-Key': this.consumerKey,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      })
      
      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details')
        
        const error = BlockAnalyzer.analyze({
          httpStatus: response.status,
          responseBody: errorText,
          url,
          provider: this.provider,
          requestId,
        })
        
        return {
          success: false,
          error,
        }
      }
      
      // Parse response
      const data = await response.json() as MaerskContainerResponse
      
      // Check if container found
      if (!data.events || data.events.length === 0) {
        return {
          success: false,
          error: {
            code: ErrorCode.CONTAINER_NOT_FOUND,
            category: ErrorCategory.VALIDATION,
            provider: this.provider,
            timestamp: new Date().toISOString(),
            requestId,
            retryable: false,
            message: 'Container not found in Maersk tracking system',
            recommendation: 'Verify container number belongs to Maersk and is in their system',
          },
        }
      }
      
      // Normalize to TrackingResult
      const trackingResult = this.normalizeResponse(containerNumber, data)
      
      this.log('info', 'Tracking operation successful', {
        containerNumber,
        requestId,
        eventsCount: data.events.length,
      })
      
      return {
        success: true,
        data: trackingResult,
      }
      
    } catch (error) {
      this.log('error', 'Tracking operation failed', {
        containerNumber,
        requestId,
        error: (error as Error).message,
      })
      
      // Classify error
      const classifiedError = BlockAnalyzer.classifyPlaywrightError(
        error as Error,
        this.provider,
        requestId
      )
      
      return {
        success: false,
        error: classifiedError,
      }
    }
  }
  
  /**
   * Get OAuth 2.0 access token
   * Uses cached token if still valid
   */
  private async getAccessToken(): Promise<string> {
    // Check if cached token is still valid
    if (this.tokenCache && this.tokenCache.expires_at > Date.now()) {
      return this.tokenCache.access_token
    }
    
    this.log('info', 'Requesting new access token', {
      tokenUrl: this.tokenUrl,
    })
    
    // Request new token
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Consumer-Key': this.consumerKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.consumerKey,
        client_secret: this.clientSecret,
      }),
      signal: AbortSignal.timeout(10000),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to get access token: HTTP ${response.status}`)
    }
    
    const tokenData = await response.json()
    
    // Cache token with expiration
    this.tokenCache = {
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      expires_at: Date.now() + (tokenData.expires_in * 1000) - 60000, // 1 minute buffer
    }
    
    this.log('info', 'Access token obtained', {
      expiresIn: tokenData.expires_in,
    })
    
    return this.tokenCache.access_token
  }
  
  /**
   * Normalize Maersk API response to TrackingResult
   */
  private normalizeResponse(
    containerNumber: string,
    data: MaerskContainerResponse
  ): TrackingResult {
    // Extract tracking events
    const events: TrackingEvent[] = data.events.map(event => ({
      eventCode: event.eventTypeCode || event.eventType,
      eventDescription: event.eventType,
      eventDate: new Date(event.eventDateTime),
      location: event.transportCall?.location?.locationName || 
                event.transportCall?.location?.UNLocationCode,
      vessel: event.transportCall?.vessel?.vesselName,
      source: 'maersk_api',
      confidence: 1.0, // Official API data has high confidence
    }))
    
    // Sort events by date (newest first)
    events.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime())
    
    // Get latest event
    const latestEvent = events[0]
    
    // Find departure and arrival events
    const departureEvent = events.find(e => 
      e.eventCode.includes('DEPA') || e.eventDescription.toLowerCase().includes('departure')
    )
    const arrivalEvent = events.find(e => 
      e.eventCode.includes('ARRI') || e.eventDescription.toLowerCase().includes('arrival')
    )
    
    return {
      containerNumber,
      shippingCompany: 'Maersk Line',
      bookingNumber: data.carrierBookingReference,
      vesselName: latestEvent?.vessel,
      currentLocation: latestEvent?.location,
      currentStatus: latestEvent?.eventDescription || 'Unknown',
      departureDate: departureEvent?.eventDate,
      actualArrival: arrivalEvent?.eventDate,
      lastUpdated: new Date(),
      trackingEvents: events,
      dataSource: 'api',
      dataQuality: 'high',
    }
  }
  
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Check if credentials are configured
      if (!this.consumerKey || !this.clientSecret) {
        return {
          healthy: false,
          lastCheck: new Date(),
          message: 'API credentials not configured',
          details: {
            apiAvailable: false,
            authenticationValid: false,
          },
        }
      }
      
      // Try to get access token
      await this.getAccessToken()
      
      const responseTimeMs = Date.now() - startTime
      
      return {
        healthy: true,
        responseTimeMs,
        lastCheck: new Date(),
        message: 'Maersk API is accessible and authenticated',
        details: {
          apiAvailable: true,
          authenticationValid: true,
        },
      }
    } catch (error) {
      return {
        healthy: false,
        lastCheck: new Date(),
        message: (error as Error).message,
        details: {
          apiAvailable: false,
          authenticationValid: false,
        },
      }
    }
  }
  
  getMetadata() {
    return {
      provider: 'maersk',
      name: 'Maersk Line',
      version: '1.0.0',
      dataSource: 'api' as const,
      capabilities: {
        realtime: true,
        historicalEvents: true,
        vesselTracking: true,
        estimatedArrival: true,
      },
    }
  }
  
  private generateRequestId(): string {
    return `maersk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
