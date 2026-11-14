/**
 * Block Analyzer
 * 
 * Classifies HTTP responses and page content to identify the specific
 * reason for failure. This enables intelligent retry logic and proper
 * error reporting.
 * 
 * IMPORTANT: Not every 403 is Cloudflare. Not every challenge is a CAPTCHA.
 * This module performs careful pattern matching to correctly identify
 * the actual failure mode.
 */

import { ErrorCode, ErrorCategory, type TrackingError } from '../models/TrackingResult.js'

export interface AnalysisContext {
  httpStatus?: number
  responseHeaders?: Record<string, string>
  responseBody?: string
  url: string
  provider: string
  requestId: string
}

export class BlockAnalyzer {
  /**
   * Analyze a failed request and classify the error
   */
  static analyze(context: AnalysisContext): TrackingError {
    const { httpStatus, responseHeaders, responseBody, url, provider, requestId } = context
    
    // Analyze HTTP status first
    if (httpStatus) {
      const statusError = this.analyzeHttpStatus(httpStatus, responseHeaders, responseBody)
      if (statusError) {
        return this.buildError(statusError, provider, requestId, url, httpStatus)
      }
    }
    
    // Analyze response body patterns
    if (responseBody) {
      const bodyError = this.analyzeResponseBody(responseBody)
      if (bodyError) {
        return this.buildError(bodyError, provider, requestId, url, httpStatus)
      }
    }
    
    // Default to unknown
    return this.buildError(
      {
        code: ErrorCode.UNKNOWN_ERROR,
        category: ErrorCategory.UNKNOWN,
        retryable: false,
        message: 'Unknown error occurred',
        recommendation: 'Investigate logs and escalate if recurring',
      },
      provider,
      requestId,
      url,
      httpStatus
    )
  }
  
  /**
   * Analyze HTTP status code
   */
  private static analyzeHttpStatus(
    status: number,
    headers?: Record<string, string>,
    body?: string
  ): Partial<TrackingError> | null {
    switch (status) {
      case 400:
        return {
          code: ErrorCode.BAD_REQUEST,
          category: ErrorCategory.VALIDATION,
          retryable: false,
          message: 'Bad request - invalid parameters',
          recommendation: 'Verify container number format and request parameters',
        }
      
      case 401:
        return {
          code: ErrorCode.UNAUTHORIZED,
          category: ErrorCategory.ACCESS_CONTROL,
          retryable: false,
          message: 'Authentication required',
          recommendation: 'Verify credentials are configured correctly',
        }
      
      case 403:
        // 403 can mean many things - check for specific patterns
        if (body?.toLowerCase().includes('cloudflare')) {
          return {
            code: ErrorCode.CLOUDFLARE_CHALLENGE,
            category: ErrorCategory.ACCESS_CONTROL,
            retryable: false,
            message: 'Cloudflare challenge detected',
            recommendation: 'Site requires human verification - use official API if available',
          }
        }
        
        if (body?.toLowerCase().includes('captcha') || body?.toLowerCase().includes('recaptcha')) {
          return {
            code: ErrorCode.CAPTCHA_REQUIRED,
            category: ErrorCategory.ACCESS_CONTROL,
            retryable: false,
            message: 'CAPTCHA verification required',
            recommendation: 'Site requires human verification - use official API if available',
          }
        }
        
        return {
          code: ErrorCode.FORBIDDEN,
          category: ErrorCategory.ACCESS_CONTROL,
          retryable: false,
          message: 'Access forbidden',
          recommendation: 'Site denies automated access - use official API if available',
        }
      
      case 404:
        // Check if it's the page that's not found or the container
        if (body?.toLowerCase().includes('container') || body?.toLowerCase().includes('shipment')) {
          return {
            code: ErrorCode.CONTAINER_NOT_FOUND,
            category: ErrorCategory.VALIDATION,
            retryable: false,
            message: 'Container not found in tracking system',
            recommendation: 'Verify container number is correct and belongs to this carrier',
          }
        }
        
        return {
          code: ErrorCode.NOT_FOUND,
          category: ErrorCategory.PROVIDER,
          retryable: false,
          message: 'Tracking page not found',
          recommendation: 'Tracking URL may have changed - update connector configuration',
        }
      
      case 429:
        const retryAfter = headers?.['retry-after']
        return {
          code: ErrorCode.TOO_MANY_REQUESTS,
          category: ErrorCategory.RATE_LIMIT,
          retryable: true,
          message: `Rate limit exceeded${retryAfter ? ` - retry after ${retryAfter}s` : ''}`,
          recommendation: 'Reduce request rate and implement exponential backoff',
          details: retryAfter ? `Retry-After: ${retryAfter}` : undefined,
        }
      
      case 500:
        return {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          category: ErrorCategory.PROVIDER,
          retryable: true,
          message: 'Provider server error',
          recommendation: 'Retry with exponential backoff',
        }
      
      case 502:
        return {
          code: ErrorCode.BAD_GATEWAY,
          category: ErrorCategory.PROVIDER,
          retryable: true,
          message: 'Bad gateway - provider may be down',
          recommendation: 'Retry with exponential backoff',
        }
      
      case 503:
        return {
          code: ErrorCode.SERVICE_UNAVAILABLE,
          category: ErrorCategory.PROVIDER,
          retryable: true,
          message: 'Service temporarily unavailable',
          recommendation: 'Provider is experiencing issues - retry with backoff',
        }
      
      case 504:
        return {
          code: ErrorCode.GATEWAY_TIMEOUT,
          category: ErrorCategory.NETWORK,
          retryable: true,
          message: 'Gateway timeout',
          recommendation: 'Retry with increased timeout',
        }
      
      default:
        return null
    }
  }
  
  /**
   * Analyze response body for error patterns
   */
  private static analyzeResponseBody(body: string): Partial<TrackingError> | null {
    const lowerBody = body.toLowerCase()
    
    // Check for Cloudflare patterns
    if (
      lowerBody.includes('checking if the site connection is secure') ||
      lowerBody.includes('cloudflare') && lowerBody.includes('ray id') ||
      lowerBody.includes('cf-browser-verification')
    ) {
      return {
        code: ErrorCode.CLOUDFLARE_CHALLENGE,
        category: ErrorCategory.ACCESS_CONTROL,
        retryable: false,
        message: 'Cloudflare browser verification required',
        recommendation: 'Site requires human verification - use official API if available',
      }
    }
    
    // Check for CAPTCHA
    if (
      lowerBody.includes('g-recaptcha') ||
      lowerBody.includes('recaptcha') ||
      lowerBody.includes('captcha') ||
      lowerBody.includes('verify you are human')
    ) {
      return {
        code: ErrorCode.CAPTCHA_REQUIRED,
        category: ErrorCategory.ACCESS_CONTROL,
        retryable: false,
        message: 'CAPTCHA verification required',
        recommendation: 'Site requires human verification - use official API if available',
      }
    }
    
    // Check for access denied
    if (
      lowerBody.includes('access denied') ||
      lowerBody.includes('you don\'t have permission')
    ) {
      return {
        code: ErrorCode.ACCESS_DENIED,
        category: ErrorCategory.ACCESS_CONTROL,
        retryable: false,
        message: 'Access denied by provider',
        recommendation: 'Provider blocks automated access - use official API if available',
      }
    }
    
    // Check for session expiration
    if (
      lowerBody.includes('session expired') ||
      lowerBody.includes('session has timed out') ||
      lowerBody.includes('please log in again')
    ) {
      return {
        code: ErrorCode.SESSION_EXPIRED,
        category: ErrorCategory.ACCESS_CONTROL,
        retryable: true,
        message: 'Session expired',
        recommendation: 'Refresh session and retry',
      }
    }
    
    // Check for invalid container
    if (
      lowerBody.includes('invalid container') ||
      lowerBody.includes('container not found') ||
      lowerBody.includes('no results found') ||
      lowerBody.includes('not found in our system')
    ) {
      return {
        code: ErrorCode.CONTAINER_NOT_FOUND,
        category: ErrorCategory.VALIDATION,
        retryable: false,
        message: 'Container not found',
        recommendation: 'Verify container number belongs to this carrier',
      }
    }
    
    return null
  }
  
  /**
   * Build complete TrackingError object
   */
  private static buildError(
    partial: Partial<TrackingError>,
    provider: string,
    requestId: string,
    url: string,
    httpStatus?: number
  ): TrackingError {
    return {
      code: partial.code || ErrorCode.UNKNOWN_ERROR,
      category: partial.category || ErrorCategory.UNKNOWN,
      provider,
      timestamp: new Date().toISOString(),
      requestId,
      sourceUrl: url,
      retryable: partial.retryable ?? false,
      httpStatus,
      message: partial.message || 'Unknown error',
      details: partial.details,
      recommendation: partial.recommendation,
    }
  }
  
  /**
   * Classify a Playwright error
   */
  static classifyPlaywrightError(error: Error, provider: string, requestId: string): TrackingError {
    const message = error.message.toLowerCase()
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return this.buildError(
        {
          code: ErrorCode.NAVIGATION_TIMEOUT,
          category: ErrorCategory.NETWORK,
          retryable: true,
          message: 'Navigation timeout',
          recommendation: 'Increase timeout or check network connectivity',
          details: error.message,
        },
        provider,
        requestId,
        ''
      )
    }
    
    if (message.includes('net::err_name_not_resolved')) {
      return this.buildError(
        {
          code: ErrorCode.DNS_FAILURE,
          category: ErrorCategory.NETWORK,
          retryable: true,
          message: 'DNS resolution failed',
          recommendation: 'Check network connectivity and DNS configuration',
          details: error.message,
        },
        provider,
        requestId,
        ''
      )
    }
    
    if (message.includes('net::err_connection_refused')) {
      return this.buildError(
        {
          code: ErrorCode.CONNECTION_REFUSED,
          category: ErrorCategory.NETWORK,
          retryable: true,
          message: 'Connection refused',
          recommendation: 'Provider may be down - retry with backoff',
          details: error.message,
        },
        provider,
        requestId,
        ''
      )
    }
    
    if (message.includes('browser has been closed') || message.includes('target closed')) {
      return this.buildError(
        {
          code: ErrorCode.BROWSER_CRASH,
          category: ErrorCategory.AUTOMATION,
          retryable: true,
          message: 'Browser crashed',
          recommendation: 'Restart browser and retry',
          details: error.message,
        },
        provider,
        requestId,
        ''
      )
    }
    
    return this.buildError(
      {
        code: ErrorCode.UNKNOWN_ERROR,
        category: ErrorCategory.UNKNOWN,
        retryable: false,
        message: error.message,
        recommendation: 'Investigate and escalate',
        details: error.stack,
      },
      provider,
      requestId,
      ''
    )
  }
}
