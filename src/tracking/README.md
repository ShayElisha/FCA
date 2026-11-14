# Production-Grade Container Tracking Engine

## Overview

This directory contains the refactored, production-ready container tracking system that replaces the previous "bypass-focused" implementation with a maintainable, enterprise-grade architecture.

## Architecture

### Core Principles

1. **No Fingerprint Spoofing**: Uses legitimate Playwright configuration
2. **Explicit Error Classification**: Different errors handled differently
3. **Intelligent Retry Logic**: Exponential backoff, circuit breakers, respect for rate limits
4. **Structured Logging**: Correlation IDs, no sensitive data
5. **Security First**: Input validation, SSRF prevention, encrypted credentials
6. **Observable**: Health checks, metrics, circuit breaker status

### Module Structure

```
src/tracking/
├── models/              # Data models and error taxonomy
│   └── TrackingResult.ts
├── diagnostics/         # Error detection and classification
│   └── BlockAnalyzer.ts
├── engine/             # Retry logic and scheduling
│   └── RetryManager.ts
├── browser/            # Playwright browser management
│   └── BrowserConfig.ts
├── connectors/         # Shipping company integrations
│   ├── ShippingConnector.ts
│   └── MSCConnector.ts
└── monitoring/         # Health checks and metrics
```

## Usage

### Basic Tracking

```typescript
import { MSCConnector } from './connectors/MSCConnector'
import { RetryManager } from './engine/RetryManager'

const connector = new MSCConnector()
const retryManager = new RetryManager()

// Validate container
const validation = connector.validateContainerNumber('MSCU1234567')
if (!validation.valid) {
  console.error(validation.error)
  return
}

// Track with retry logic
const result = await retryManager.executeWithRetry(
  'msc',
  () => connector.track('MSCU1234567'),
  { containerNumber: 'MSCU1234567', requestId: 'req-123' }
)

if (result.success) {
  console.log('Tracking data:', result.data)
} else {
  console.error('Error:', result.error)
}
```

### Health Monitoring

```typescript
const health = await connector.healthCheck()
console.log('Provider health:', health)

// Check circuit breaker status
const circuits = retryManager.getCircuitStatus()
for (const [provider, state] of circuits) {
  console.log(`${provider}: ${state.state}`)
}
```

## Error Handling

### Error Categories

1. **NETWORK** - Retry with exponential backoff
2. **RATE_LIMIT** - Back off and respect Retry-After headers
3. **ACCESS_CONTROL** - Log and escalate, don't retry
4. **VALIDATION** - Fix input, don't retry
5. **PROVIDER** - Retry with backoff
6. **AUTOMATION** - Retry with new session
7. **CONFIGURATION** - Fix config, don't retry
8. **UNKNOWN** - Escalate for investigation

### Circuit Breaker

The RetryManager implements a circuit breaker per provider:

- **CLOSED**: Normal operation
- **OPEN**: Provider failing, reject immediately for cooldown period
- **HALF_OPEN**: Testing recovery

Configuration:
- Threshold: 5 consecutive failures
- Timeout: 60 seconds
- Cooldown: 5 minutes

## Configuration

### Environment Variables

```env
# Browser
BROWSER_HEADLESS=true
BROWSER_TIMEOUT_MS=30000
BROWSER_NAV_TIMEOUT_MS=30000

# Retry
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY_MS=1000
RETRY_MAX_DELAY_MS=30000

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT_MS=60000
CIRCUIT_BREAKER_COOLDOWN_MS=300000
```

## Connectors

### Implemented

- ✅ **MSCConnector**: Mediterranean Shipping Company (scraping)
  - Status: Partially functional (awaiting browser engine integration)
  - Owner codes: MSCU, MEDU, MSKU, TRHU

### Pending Implementation

- ⏳ **MaerskConnector**: Maersk Line
- ⏳ **CMAConnector**: CMA CGM
- ⏳ **COSCOConnector**: COSCO Shipping
- ⏳ **EvergreenConnector**: Evergreen Marine
- ⏳ **HapagLloydConnector**: Hapag-Lloyd
- ⏳ **ONEConnector**: Ocean Network Express

### Adding a New Connector

1. Create `YourCarrierConnector.ts` extending `BaseShippingConnector`
2. Implement required methods:
   - `validateContainerNumber()`
   - `track()`
   - `healthCheck()`
   - `getMetadata()`
3. Register in `ConnectorFactory` (when created)
4. Add tests
5. Update documentation

## Testing

### Test Structure

```
tests/
├── unit/
│   ├── models/
│   │   └── TrackingResult.test.ts
│   ├── diagnostics/
│   │   └── BlockAnalyzer.test.ts
│   ├── engine/
│   │   └── RetryManager.test.ts
│   └── connectors/
│       └── MSCConnector.test.ts
└── integration/
    └── tracking-flow.test.ts
```

### Running Tests

**TODO**: Add Vitest or Jest configuration

```bash
# Install testing framework
npm install -D vitest @vitest/ui

# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Security

### Input Validation

All container numbers are validated:
- ISO 6346 format check
- Check digit validation
- Owner code verification

### Credential Protection

- Never log passwords, tokens, or cookies
- Encrypt stored credentials
- Use environment variables for secrets
- Sanitize all log output

### SSRF Prevention

- Validate all URLs
- Whitelist allowed domains
- No user-controlled URL construction

## Logging

### Structured Format

```json
{
  "timestamp": "2026-11-14T12:00:00.000Z",
  "level": "info",
  "module": "MSCConnector",
  "operation": "track",
  "provider": "msc",
  "containerNumber": "MSCU1234567",
  "requestId": "msc-1731588000000-abc123",
  "durationMs": 2340,
  "status": "success"
}
```

### Log Levels

- **info**: Normal operations
- **warn**: Recoverable issues (retries, dead letter queue)
- **error**: Failures (circuit breaker, exhausted retries)
- **debug**: Detailed debugging (browser console errors)

### Correlation IDs

Every tracking operation gets a unique `requestId` that follows the request through all retry attempts and logs.

## Performance

### Resource Limits

- Maximum concurrent browser contexts: 5
- Maximum retry attempts: 3
- Maximum delay between retries: 30 seconds
- Circuit breaker timeout: 60 seconds

### Scaling

For high-volume deployments (100+ containers):
- Use `TrackingScheduler` for job management
- Implement provider-specific rate limits
- Consider external queue (Redis/RabbitMQ)
- Deploy worker pool architecture

## Migration from Legacy Code

### Removed Components

- ❌ `server/universal-bypass.ts` - Unreliable fingerprint spoofing
- ❌ `server/stealth-cdp.ts` - CDP manipulation hacks
- ❌ Canvas/WebGL noise injection
- ❌ Navigator property overrides
- ❌ Hardware spoofing (battery, audio)

### Integration Points

The new system integrates with existing code through:

1. `server/handlers/scrapeOne.ts` - Update to use connectors
2. `server/scrapers/*.ts` - Convert to connector pattern
3. `server/types.ts` - Align with TrackingResult model

See `MIGRATION_GUIDE.md` for detailed migration steps.

## Known Limitations

1. **API Availability**: Most carriers don't provide public APIs
2. **Access Control**: Some sites explicitly block automation
3. **Rate Limits**: Vary by provider and are often undocumented
4. **Data Quality**: Depends on carrier website structure changes
5. **Real-time Updates**: Not all carriers provide real-time data

## Support

### When Access is Blocked

If a connector reports `ACCESS_DENIED` or `CAPTCHA_REQUIRED`:

1. **Don't retry** - It won't work
2. **Check for official API** - Contact carrier for API access
3. **Use external provider** - Consider services like 17track.net
4. **Manual verification** - Some shipments may require manual checking

### Circuit Breaker is Open

If a provider's circuit breaker is open:

```typescript
// Check status
const status = retryManager.getCircuitStatus()

// Manually reset (after verifying provider is healthy)
retryManager.resetCircuit('msc')
```

### Dead Letter Queue

Failed validation errors go to the dead letter queue:

```typescript
const dlq = retryManager.getDeadLetterQueue()
for (const [container, { error, attempts }] of dlq) {
  console.log(`${container}: ${error.message} (${attempts} attempts)`)
}
```

## Roadmap

### Phase 1: Foundation (COMPLETE)
- ✅ Core models
- ✅ BlockAnalyzer
- ✅ RetryManager
- ✅ BrowserConfig
- ✅ Connector interface

### Phase 2: Browser Engine (IN PROGRESS)
- ⏳ SessionManager
- ⏳ BrowserAutomationEngine
- ⏳ Screenshot capture
- ⏳ Diagnostic HTML export

### Phase 3: Connectors (IN PROGRESS)
- ✅ MSC (partial)
- ⏳ Maersk
- ⏳ CMA CGM
- ⏳ COSCO
- ⏳ Evergreen
- ⏳ Hapag-Lloyd
- ⏳ ONE

### Phase 4: Scheduler & Monitoring (PLANNED)
- ⏳ TrackingScheduler
- ⏳ ProviderHealthMonitor
- ⏳ MetricsCollector
- ⏳ AlertManager

### Phase 5: Testing (PLANNED)
- ⏳ Unit tests
- ⏳ Integration tests
- ⏳ Performance tests
- ⏳ Security tests

## Contributing

When adding features:

1. Follow existing patterns
2. Add comprehensive error handling
3. Include structured logging
4. Write tests
5. Update documentation
6. Never log sensitive data
7. Validate all inputs

## Questions?

See:
- `REFACTORING_PLAN.md` - Complete refactoring strategy
- `MIGRATION_GUIDE.md` - Migrating from legacy code
- `../../docs/TROUBLESHOOTING.md` - Common issues

---

**Status**: Phase 1 Complete, Phase 2-5 In Progress
**Last Updated**: November 14, 2026
