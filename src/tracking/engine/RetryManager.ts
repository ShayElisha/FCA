/**
 * Retry Manager
 * 
 * Implements intelligent retry logic with:
 * - Exponential backoff with full jitter
 * - Respect for Retry-After headers
 * - Circuit breaker per provider
 * - Provider cooldown periods
 * - Dead letter queue for permanent failures
 * 
 * Different error categories receive different retry treatment:
 * - NETWORK: Retry with exponential backoff
 * - RATE_LIMIT: Back off and respect Retry-After
 * - ACCESS_CONTROL: Don't retry (escalate)
 * - VALIDATION: Don't retry (fix input)
 * - PROVIDER: Retry with backoff
 * - AUTOMATION: Retry with new session
 * - CONFIGURATION: Don't retry (fix config)
 */

import { ErrorCategory, type TrackingError } from '../models/TrackingResult.js'

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number
  
  /** Base delay in milliseconds */
  baseDelayMs: number
  
  /** Maximum delay in milliseconds */
  maxDelayMs: number
  
  /** Circuit breaker threshold (consecutive failures) */
  circuitBreakerThreshold: number
  
  /** Circuit breaker timeout in milliseconds */
  circuitBreakerTimeoutMs: number
  
  /** Provider cooldown after circuit opens (milliseconds) */
  providerCooldownMs: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeoutMs: 60000,
  providerCooldownMs: 300000, // 5 minutes
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

interface CircuitBreakerState {
  state: CircuitState
  failureCount: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  nextTestTime?: Date
}

export class RetryManager {
  private config: RetryConfig
  private circuits: Map<string, CircuitBreakerState> = new Map()
  private deadLetterQueue: Map<string, { error: TrackingError; attempts: number }> = new Map()
  
  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
  }
  
  /**
   * Execute an operation with retry logic
   */
  async executeWithRetry<T>(
    provider: string,
    operation: () => Promise<T>,
    context: { containerNumber: string; requestId: string }
  ): Promise<T> {
    // Check circuit breaker first
    const circuitState = this.getCircuitState(provider)
    if (circuitState.state === CircuitState.OPEN) {
      if (circuitState.nextTestTime && new Date() < circuitState.nextTestTime) {
        throw new Error(
          `Circuit breaker is OPEN for provider ${provider}. ` +
          `Next test at ${circuitState.nextTestTime.toISOString()}`
        )
      } else {
        // Move to half-open for testing
        this.updateCircuitState(provider, { state: CircuitState.HALF_OPEN })
      }
    }
    
    let lastError: Error | undefined
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await operation()
        
        // Success - reset circuit breaker
        this.recordSuccess(provider)
        
        return result
      } catch (error) {
        lastError = error as Error
        
        // Check if this is a classified error
        const trackingError = (error as any).trackingError as TrackingError | undefined
        
        if (!trackingError) {
          // Unclassified error - treat as retryable
          if (attempt < this.config.maxAttempts) {
            const delay = this.calculateDelay(attempt)
            this.log('warn', `Unclassified error, retrying after ${delay}ms`, {
              provider,
              attempt,
              error: lastError.message,
            })
            await this.sleep(delay)
            continue
          }
        } else {
          // Check if retryable based on category
          const shouldRetry = this.shouldRetry(trackingError, attempt)
          
          if (!shouldRetry.retry) {
            this.log('info', `Not retrying: ${shouldRetry.reason}`, {
              provider,
              errorCode: trackingError.code,
              category: trackingError.category,
            })
            
            // Record in dead letter queue if validation error
            if (trackingError.category === ErrorCategory.VALIDATION) {
              this.addToDeadLetterQueue(context.containerNumber, trackingError, attempt)
            }
            
            throw error
          }
          
          // Record failure and check circuit breaker
          this.recordFailure(provider)
          
          if (attempt < this.config.maxAttempts) {
            const delay = this.calculateRetryDelay(trackingError, attempt)
            this.log('info', `Retrying after ${delay}ms`, {
              provider,
              attempt,
              errorCode: trackingError.code,
              category: trackingError.category,
            })
            await this.sleep(delay)
            continue
          }
        }
      }
    }
    
    // All retries exhausted
    this.recordFailure(provider)
    throw lastError || new Error('Operation failed after retries')
  }
  
  /**
   * Check if error should be retried
   */
  private shouldRetry(
    error: TrackingError,
    currentAttempt: number
  ): { retry: boolean; reason: string } {
    // Never retry these categories
    const nonRetryableCategories = [
      ErrorCategory.ACCESS_CONTROL,
      ErrorCategory.VALIDATION,
      ErrorCategory.CONFIGURATION,
    ]
    
    if (nonRetryableCategories.includes(error.category)) {
      return {
        retry: false,
        reason: `Error category ${error.category} is not retryable`,
      }
    }
    
    // Check explicit retryable flag
    if (!error.retryable) {
      return {
        retry: false,
        reason: 'Error explicitly marked as non-retryable',
      }
    }
    
    // Check attempt limit
    if (currentAttempt >= this.config.maxAttempts) {
      return {
        retry: false,
        reason: 'Maximum retry attempts reached',
      }
    }
    
    return {
      retry: true,
      reason: 'Error is retryable',
    }
  }
  
  /**
   * Calculate retry delay based on error type
   */
  private calculateRetryDelay(error: TrackingError, attempt: number): number {
    // Respect Retry-After header for rate limits
    if (error.category === ErrorCategory.RATE_LIMIT && error.details) {
      const match = error.details.match(/Retry-After: (\d+)/)
      if (match) {
        const retryAfterSeconds = parseInt(match[1], 10)
        return Math.min(retryAfterSeconds * 1000, this.config.maxDelayMs)
      }
    }
    
    // Exponential backoff with full jitter
    return this.calculateDelay(attempt)
  }
  
  /**
   * Calculate exponential backoff with full jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.config.baseDelayMs * Math.pow(2, attempt - 1),
      this.config.maxDelayMs
    )
    
    // Full jitter: random value between 0 and exponentialDelay
    return Math.floor(Math.random() * exponentialDelay)
  }
  
  /**
   * Get circuit breaker state for provider
   */
  private getCircuitState(provider: string): CircuitBreakerState {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        state: CircuitState.CLOSED,
        failureCount: 0,
      })
    }
    return this.circuits.get(provider)!
  }
  
  /**
   * Update circuit breaker state
   */
  private updateCircuitState(provider: string, updates: Partial<CircuitBreakerState>): void {
    const current = this.getCircuitState(provider)
    this.circuits.set(provider, { ...current, ...updates })
  }
  
  /**
   * Record successful operation
   */
  private recordSuccess(provider: string): void {
    const state = this.getCircuitState(provider)
    
    if (state.state === CircuitState.HALF_OPEN) {
      // Recovery confirmed - close circuit
      this.log('info', `Circuit breaker CLOSED for ${provider} after successful test`)
      this.updateCircuitState(provider, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastSuccessTime: new Date(),
      })
    } else {
      // Normal success - reset failure count
      this.updateCircuitState(provider, {
        failureCount: 0,
        lastSuccessTime: new Date(),
      })
    }
  }
  
  /**
   * Record failed operation
   */
  private recordFailure(provider: string): void {
    const state = this.getCircuitState(provider)
    const newFailureCount = state.failureCount + 1
    
    this.updateCircuitState(provider, {
      failureCount: newFailureCount,
      lastFailureTime: new Date(),
    })
    
    // Check if should open circuit
    if (newFailureCount >= this.config.circuitBreakerThreshold) {
      const nextTestTime = new Date(Date.now() + this.config.circuitBreakerTimeoutMs)
      
      this.log('error', `Circuit breaker OPENED for ${provider} after ${newFailureCount} failures`, {
        nextTestTime: nextTestTime.toISOString(),
      })
      
      this.updateCircuitState(provider, {
        state: CircuitState.OPEN,
        nextTestTime,
      })
    }
  }
  
  /**
   * Add to dead letter queue
   */
  private addToDeadLetterQueue(
    containerNumber: string,
    error: TrackingError,
    attempts: number
  ): void {
    this.deadLetterQueue.set(containerNumber, { error, attempts })
    this.log('warn', 'Added to dead letter queue', {
      containerNumber,
      errorCode: error.code,
      attempts,
    })
  }
  
  /**
   * Get circuit breaker status for all providers
   */
  getCircuitStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuits)
  }
  
  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): Map<string, { error: TrackingError; attempts: number }> {
    return new Map(this.deadLetterQueue)
  }
  
  /**
   * Manually reset circuit breaker for a provider
   */
  resetCircuit(provider: string): void {
    this.log('info', `Manually resetting circuit breaker for ${provider}`)
    this.circuits.set(provider, {
      state: CircuitState.CLOSED,
      failureCount: 0,
    })
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Structured logging
   */
  private log(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      module: 'RetryManager',
      message,
      ...context,
    }))
  }
}
