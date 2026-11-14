# Production-Grade Container Tracking Engine - Refactoring Plan

## Executive Summary

This document outlines the complete refactoring from the current "bypass-focused" implementation to a production-grade, enterprise-ready container tracking system.

## Current State Analysis

### Problems Identified
1. **Fingerprint Spoofing**: Unreliable hardware/browser manipulation
2. **No Error Classification**: All failures treated equally
3. **No Retry Logic**: Single-attempt failures
4. **No Session Management**: Browser instances not reused
5. **No Structured Logging**: Debugging difficulties
6. **No Testing**: No automated tests
7. **Security Concerns**: Credentials potentially exposed
8. **No Monitoring**: No health checks or metrics

### Files to Remove/Replace
- `server/universal-bypass.ts` - Remove entirely
- `server/stealth-cdp.ts` - Remove entirely  
- `server/scraper-helpers.ts` - Replace with proper helpers
- `server/browser.ts` - Simplify dramatically

### Files to Refactor
- `server/scrapers/*.ts` - Convert to proper connectors
- `server/handlers/scrapeOne.ts` - Add error handling
- `server/types.ts` - Expand with proper models

## New Architecture

### Module Structure

```
src/tracking/
├── models/
│   ├── TrackingResult.ts          # Normalized tracking data
│   ├── TrackingEvent.ts           # Individual tracking events
│   ├── ErrorClassification.ts     # Error taxonomy
│   └── ProviderHealth.ts          # Health metrics
│
├── diagnostics/
│   ├── BlockAnalyzer.ts           # Classify HTTP/access errors
│   ├── ErrorDetector.ts           # Pattern detection
│   └── DiagnosticLogger.ts        # Structured logging
│
├── engine/
│   ├── RetryManager.ts            # Exponential backoff + circuit breaker
│   ├── TrackingScheduler.ts      # Job scheduling
│   └── RateLimiter.ts            # Per-provider rate limits
│
├── browser/
│   ├── SessionManager.ts          # Browser lifecycle
│   ├── BrowserAutomationEngine.ts # Playwright wrapper
│   └── BrowserConfig.ts           # Legitimate configuration
│
├── connectors/
│   ├── ShippingConnector.ts       # Base interface
│   ├── MaerskConnector.ts
│   ├── MSCConnector.ts
│   ├── CMAConnector.ts
│   ├── COSCOConnector.ts
│   ├── EvergreenConnector.ts
│   ├── HapagLloydConnector.ts
│   ├── ONEConnector.ts
│   └── ConnectorFactory.ts
│
└── monitoring/
    ├── ProviderHealthMonitor.ts   # Health checks
    ├── MetricsCollector.ts        # Performance metrics
    └── AlertManager.ts            # Threshold alerts
```

## Implementation Phases

### Phase 1: Foundation (Priority: CRITICAL)
**Estimated: 4-6 hours**

1. Create core data models
2. Implement BlockAnalyzer
3. Implement RetryManager
4. Create legitimate BrowserConfig
5. Basic SessionManager

**Deliverables**:
- `src/tracking/models/TrackingResult.ts`
- `src/tracking/models/ErrorClassification.ts`
- `src/tracking/diagnostics/BlockAnalyzer.ts`
- `src/tracking/engine/RetryManager.ts`
- `src/tracking/browser/BrowserConfig.ts`
- `src/tracking/browser/SessionManager.ts`

### Phase 2: Browser Engine (Priority: HIGH)
**Estimated: 3-4 hours**

1. Professional Playwright wrapper
2. Proper timeout handling
3. Screenshot capture
4. Graceful shutdown
5. Resource limits

**Deliverables**:
- `src/tracking/browser/BrowserAutomationEngine.ts`
- Tests for browser management

### Phase 3: Connector Architecture (Priority: HIGH)
**Estimated: 6-8 hours**

1. Define ShippingConnector interface
2. Convert existing scrapers to connectors
3. Add connector-level error handling
4. Add connector-level retry logic
5. Add health checks per connector

**Deliverables**:
- `src/tracking/connectors/ShippingConnector.ts`
- 7 connector implementations
- `src/tracking/connectors/ConnectorFactory.ts`

### Phase 4: Scheduler & Monitoring (Priority: MEDIUM)
**Estimated: 4-5 hours**

1. Job queue implementation
2. Concurrency control
3. Provider health monitoring
4. Metrics collection
5. Alert thresholds

**Deliverables**:
- `src/tracking/engine/TrackingScheduler.ts`
- `src/tracking/monitoring/ProviderHealthMonitor.ts`
- `src/tracking/monitoring/MetricsCollector.ts`

### Phase 5: Testing & Documentation (Priority: HIGH)
**Estimated: 4-6 hours**

1. Unit tests for all modules
2. Integration tests
3. Mock shipping provider responses
4. Performance tests
5. Security tests
6. Complete API documentation

**Deliverables**:
- `tests/` directory with comprehensive coverage
- `docs/API.md`
- `docs/DEPLOYMENT.md`

### Phase 6: Integration & Migration (Priority: CRITICAL)
**Estimated: 2-3 hours**

1. Update server/handlers/scrapeOne.ts
2. Update server/index.ts
3. Migration guide
4. Backward compatibility layer (temporary)
5. Deprecation warnings

**Deliverables**:
- Updated integration points
- `MIGRATION_GUIDE.md`
- Backward compatibility shims

## Total Estimated Time: 23-32 hours

## Key Design Decisions

### 1. No Fingerprint Spoofing
**Why**: Unreliable, breaks frequently, violates website policies
**Instead**: Use legitimate Playwright configuration, respect robots.txt

### 2. Explicit Error Classification
**Why**: Different errors require different handling
**Categories**:
- `NETWORK_ERROR` - Retry with exponential backoff
- `RATE_LIMITED` - Back off with provider cooldown
- `ACCESS_DENIED` - Log and escalate, don't retry
- `CAPTCHA_REQUIRED` - Escalate to human
- `INVALID_CONTAINER` - Don't retry
- `PROVIDER_DOWN` - Circuit breaker

### 3. Circuit Breaker Pattern
**Why**: Prevent cascading failures
**Implementation**:
- Track failure rate per provider
- Open circuit after N consecutive failures
- Half-open state with test requests
- Close circuit after M successful requests

### 4. Legitimate Browser Configuration
```typescript
{
  headless: true,
  viewport: { width: 1920, height: 1080 },
  userAgent: 'FCA-Container-Tracker/1.0 (contact@example.com)',
  locale: 'en-US',
  timezoneId: 'America/New_York',
  // NO fingerprint manipulation
  // NO WebGL/Canvas spoofing
  // NO navigator overrides
}
```

### 5. Structured Logging
```typescript
{
  timestamp: '2026-11-14T12:00:00Z',
  correlationId: 'uuid',
  level: 'info',
  module: 'MaerskConnector',
  operation: 'track',
  containerNumber: 'MAEU1234567',
  durationMs: 2340,
  status: 'success',
  provider: 'maersk',
  // NO sensitive data
}
```

### 6. Security Requirements
- **Validate**: All container numbers (ISO 6346)
- **Sanitize**: All inputs
- **Encrypt**: Stored credentials
- **Audit**: All access attempts
- **Rate Limit**: Per client, per provider
- **NEVER LOG**: Passwords, tokens, cookies

## Environment Variables

```env
# Browser
BROWSER_HEADLESS=true
BROWSER_TIMEOUT_MS=30000
BROWSER_MAX_CONCURRENT=5

# Retry
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY_MS=1000
RETRY_MAX_DELAY_MS=10000

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT_MS=60000

# Rate Limiting
RATE_LIMIT_PER_PROVIDER=10
RATE_LIMIT_WINDOW_MS=60000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Security
ENCRYPT_CREDENTIALS=true
CREDENTIALS_KEY=<set-securely>

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL_MS=30000
```

## Testing Strategy

### Unit Tests
- ISO 6346 validation
- Error classification
- Retry logic
- Circuit breaker
- Rate limiter
- Data normalization

### Integration Tests
- Mock shipping provider responses
- End-to-end tracking flow
- Error handling
- Session management
- Browser lifecycle

### Performance Tests
- 100 containers concurrently
- 500 containers over 1 hour
- Memory leak detection
- Resource cleanup

### Security Tests
- Input validation
- SSRF prevention
- Credential protection
- Log sanitization

## Migration Path

### Step 1: Install New Modules (Non-Breaking)
Deploy new modules alongside existing code

### Step 2: Add Feature Flags
```typescript
const USE_NEW_TRACKING_ENGINE = process.env.FEATURE_NEW_ENGINE === 'true'
```

### Step 3: Gradual Rollout
- 10% traffic → new engine
- Monitor errors
- 50% traffic → new engine
- 100% traffic → new engine

### Step 4: Remove Old Code
After 2 weeks of stable operation, remove:
- `server/universal-bypass.ts`
- `server/stealth-cdp.ts`
- All fingerprint spoofing

## Success Metrics

### Reliability
- ✅ 95%+ success rate (excluding access-denied)
- ✅ < 1% unclassified errors
- ✅ Circuit breaker prevents cascades

### Performance
- ✅ < 10s average tracking time
- ✅ 100 containers/minute throughput
- ✅ < 500MB memory for 500 containers

### Maintainability
- ✅ 80%+ test coverage
- ✅ All errors have error codes
- ✅ Structured logs for all operations

### Security
- ✅ All inputs validated
- ✅ No credentials in logs
- ✅ Encrypted storage

## Known Limitations

1. **API Availability**: Many carriers don't provide public APIs
2. **Access Control**: Some sites explicitly block automation
3. **Rate Limits**: Vary by provider
4. **Data Quality**: Depends on carrier website structure
5. **Real-time**: Not all carriers provide real-time data

## Next Steps

1. **Review this plan** with team
2. **Approve architecture** decisions
3. **Begin Phase 1** implementation
4. **Set up CI/CD** for testing
5. **Plan rollout** schedule

## Questions for Stakeholders

1. Do we have official API access for any carriers?
2. What's the acceptable error rate?
3. What's the budget for external APIs/proxies?
4. What's the timeline for production deployment?
5. What monitoring tools are in place (Datadog, New Relic, etc.)?
6. Is there existing Redis/queue infrastructure?
7. What's the authentication strategy for authorized sessions?

---

**Status**: Planning Complete - Awaiting Approval to Begin Implementation
**Date**: November 14, 2026
**Author**: Senior Staff Engineer
