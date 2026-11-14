/**
 * Normalized Container Tracking Result
 * 
 * This model standardizes tracking data across all shipping providers.
 * All optional fields must be handled gracefully.
 */

export interface TrackingEvent {
  /** Standardized event code (e.g., 'DEPARTED', 'ARRIVED', 'DISCHARGED') */
  eventCode: string
  
  /** Human-readable event description */
  eventDescription: string
  
  /** Event timestamp (UTC) */
  eventDate: Date
  
  /** Location where event occurred */
  location?: string
  
  /** Vessel name at time of event */
  vessel?: string
  
  /** Data source (e.g., 'maersk_api', 'msc_scrape') */
  source: string
  
  /** Confidence level (0.0-1.0) */
  confidence: number
}

export interface TrackingResult {
  // Core identifiers
  containerNumber: string
  shippingCompany: string
  
  // Booking information
  bookingNumber?: string
  billOfLading?: string
  
  // Vessel information
  vesselName?: string
  voyageNumber?: string
  
  // Location information
  originPort?: string
  destinationPort?: string
  currentLocation?: string
  
  // Status
  currentStatus: string
  
  // Dates (all in UTC)
  estimatedArrival?: Date
  actualArrival?: Date
  departureDate?: Date
  lastFreeDay?: Date
  
  // Metadata
  lastUpdated: Date
  trackingEvents: TrackingEvent[]
  
  // Data quality
  dataSource: 'api' | 'edi' | 'scrape' | 'external_provider'
  dataQuality: 'high' | 'medium' | 'low'
  
  // Additional carrier-specific data
  carrierSpecificData?: Record<string, unknown>
}

/**
 * Tracking operation result
 */
export type TrackingOperationResult =
  | { success: true; data: TrackingResult }
  | { success: false; error: TrackingError }

/**
 * Tracking error with classification
 */
export interface TrackingError {
  /** Unique error code */
  code: ErrorCode
  
  /** Error category for handling logic */
  category: ErrorCategory
  
  /** Shipping company identifier */
  provider: string
  
  /** ISO 8601 timestamp */
  timestamp: string
  
  /** Correlation ID for request tracing */
  requestId: string
  
  /** Source URL that failed */
  sourceUrl?: string
  
  /** Whether this error is retryable */
  retryable: boolean
  
  /** HTTP status code if applicable */
  httpStatus?: number
  
  /** Human-readable explanation */
  message: string
  
  /** Technical details for debugging */
  details?: string
  
  /** Recommended action */
  recommendation?: string
}

/**
 * Error codes (exhaustive list)
 */
export enum ErrorCode {
  // Network errors (retryable)
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  DNS_FAILURE = 'DNS_FAILURE',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  TLS_ERROR = 'TLS_ERROR',
  
  // HTTP errors
  BAD_REQUEST = 'BAD_REQUEST',              // 400
  UNAUTHORIZED = 'UNAUTHORIZED',            // 401
  FORBIDDEN = 'FORBIDDEN',                  // 403
  NOT_FOUND = 'NOT_FOUND',                  // 404
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS', // 429
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR', // 500
  BAD_GATEWAY = 'BAD_GATEWAY',             // 502
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE', // 503
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',     // 504
  
  // Access control (not retryable)
  CLOUDFLARE_CHALLENGE = 'CLOUDFLARE_CHALLENGE',
  CAPTCHA_REQUIRED = 'CAPTCHA_REQUIRED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  
  // Application errors
  INVALID_CONTAINER_NUMBER = 'INVALID_CONTAINER_NUMBER',
  CONTAINER_NOT_FOUND = 'CONTAINER_NOT_FOUND',
  UNSUPPORTED_TRACKING_PAGE = 'UNSUPPORTED_TRACKING_PAGE',
  PARSE_ERROR = 'PARSE_ERROR',
  DATA_VALIDATION_ERROR = 'DATA_VALIDATION_ERROR',
  
  // Browser errors
  BROWSER_CRASH = 'BROWSER_CRASH',
  PAGE_CRASH = 'PAGE_CRASH',
  NAVIGATION_TIMEOUT = 'NAVIGATION_TIMEOUT',
  
  // Configuration errors
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  
  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error categories for handling logic
 */
export enum ErrorCategory {
  /** Network/transport layer failures - retry with backoff */
  NETWORK = 'NETWORK',
  
  /** Rate limiting - back off and respect headers */
  RATE_LIMIT = 'RATE_LIMIT',
  
  /** Access control - escalate, don't retry */
  ACCESS_CONTROL = 'ACCESS_CONTROL',
  
  /** Invalid input - don't retry */
  VALIDATION = 'VALIDATION',
  
  /** Provider/server issues - retry with backoff */
  PROVIDER = 'PROVIDER',
  
  /** Browser/automation issues - retry with new session */
  AUTOMATION = 'AUTOMATION',
  
  /** Configuration issues - fix config, don't retry */
  CONFIGURATION = 'CONFIGURATION',
  
  /** Unknown - escalate for investigation */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Container validation result
 */
export interface ContainerValidation {
  valid: boolean
  containerNumber?: string
  error?: string
}
