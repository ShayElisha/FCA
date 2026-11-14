# Maersk API Setup Guide

## Overview

Maersk provides an **official, free API** for container tracking through their Developer Portal. This is **significantly better** than attempting to scrape their website.

## Why Use the Official API?

### ✅ Benefits

1. **Legally Compliant**: Official, terms-of-service compliant access
2. **Reliable**: Won't break when website changes
3. **No Blocking**: No anti-bot challenges or CAPTCHAs
4. **High Quality Data**: Structured, validated, real-time data
5. **Officially Supported**: Maersk provides documentation and support
6. **Better Performance**: Direct API calls, no browser overhead
7. **Rate Limits**: Clear, documented limits (600 requests/minute)

### ❌ Problems with Website Scraping

1. **Illegal**: Violates terms of service
2. **Unreliable**: Breaks when website changes
3. **Blocked**: Anti-bot systems (Cloudflare, etc.)
4. **Poor Data Quality**: HTML parsing is fragile
5. **Slow**: Browser automation is resource-intensive
6. **No Support**: When it breaks, you're on your own

## Setup Instructions

### Step 1: Register on Maersk Developer Portal

1. Go to https://developer.maersk.com/
2. Click **"Sign Up"** (top right)
3. Fill in your details:
   - Email
   - Company name
   - Name
   - Country
4. Verify your email
5. Log in

### Step 2: Create an Application

1. Once logged in, go to **"My Apps"**
2. Click **"Create New App"**
3. Fill in app details:
   - **App Name**: "Container Tracking System" (or your name)
   - **App Description**: "Container tracking for logistics management"
   - **Website**: Your company website
4. Click **"Create"**

### Step 3: Subscribe to Track & Trace Plus API

1. In your app page, click **"API Products"**
2. Find **"Track & Trace Plus"**
3. Click **"Subscribe"**
4. Read and accept the terms
5. Subscription is usually approved instantly

### Step 4: Get Your Credentials

After subscription is approved:

1. Go to your app page
2. You'll see:
   - **Consumer Key** (also called API Key)
   - **Consumer Secret** (also called Client Secret)
3. Copy both values

**IMPORTANT**: Keep your Consumer Secret secure - treat it like a password!

### Step 5: Configure Environment Variables

Add to your `.env` file:

```env
MAERSK_CONSUMER_KEY=your_consumer_key_here
MAERSK_CLIENT_SECRET=your_client_secret_here
```

**Never commit these credentials to git!**

## Usage

### Basic Example

```typescript
import { MaerskConnector } from './src/tracking/connectors/MaerskConnector'
import { RetryManager } from './src/tracking/engine/RetryManager'

const connector = new MaerskConnector()
const retryManager = new RetryManager()

// Validate container
const validation = connector.validateContainerNumber('MAEU1234567')
if (!validation.valid) {
  console.error(validation.error)
  return
}

// Track with retry logic
const result = await retryManager.executeWithRetry(
  'maersk',
  () => connector.track('MAEU1234567'),
  { containerNumber: 'MAEU1234567', requestId: 'req-123' }
)

if (result.success) {
  console.log('Container:', result.data.containerNumber)
  console.log('Status:', result.data.currentStatus)
  console.log('Location:', result.data.currentLocation)
  console.log('Events:', result.data.trackingEvents.length)
} else {
  console.error('Error:', result.error.message)
  console.error('Recommendation:', result.error.recommendation)
}
```

### Health Check

```typescript
const health = await connector.healthCheck()

if (health.healthy) {
  console.log('✅ Maersk API is working')
  console.log(`Response time: ${health.responseTimeMs}ms`)
} else {
  console.log('❌ Maersk API is down')
  console.log('Error:', health.message)
}
```

## API Details

### Authentication

Maersk uses **OAuth 2.0 Client Credentials** flow:

1. Request token from: `https://api.maersk.com/customer-identity/oauth/v2/access_token`
2. Use token in subsequent API calls
3. Tokens expire after ~1 hour (automatically refreshed by connector)

### Endpoints Used

**Container Events**:
```
GET https://api.maersk.com/track-and-trace-private/events?equipmentReference={containerNumber}
```

**Headers**:
```
Authorization: Bearer {access_token}
Consumer-Key: {your_consumer_key}
Accept: application/json
```

### Rate Limits

- **Requests per second**: 10
- **Requests per minute**: 600
- **Requests per day**: Unlimited (within reason)

If you exceed rate limits:
- Response: HTTP 429 (Too Many Requests)
- Retry-After header tells you when to retry
- RetryManager handles this automatically

## Supported Owner Codes

Maersk connector supports containers with these owner codes:

- **MAEU** - Maersk Line
- **MAER** - Maersk Line (alternative)
- **SEJJ** - SeaLand (Maersk subsidiary)
- **MCPU** - MCC Transport (Maersk subsidiary)
- **MAGU** - Maersk Line
- **MSCU** - Hamburg Süd (some containers)

## Response Data

The API provides:

- **Container number**
- **Booking reference**
- **Event history** (chronological)
  - Event type and description
  - Date and time (UTC)
  - Location (with UN/LOCODE)
  - Vessel name and IMO number
  - Empty/loaded status
- **Current status**
- **Current location**
- **Vessel information**

## Error Handling

### Common Errors

1. **Missing Credentials**
   - Error: `MISSING_CREDENTIALS`
   - Fix: Set `MAERSK_CONSUMER_KEY` and `MAERSK_CLIENT_SECRET`

2. **Invalid Credentials**
   - Error: `UNAUTHORIZED` (HTTP 401)
   - Fix: Verify credentials are correct, regenerate if needed

3. **Container Not Found**
   - Error: `CONTAINER_NOT_FOUND`
   - Reason: Container doesn't exist or isn't in Maersk's system
   - Fix: Verify container number, check owner code

4. **Rate Limited**
   - Error: `TOO_MANY_REQUESTS` (HTTP 429)
   - Handling: RetryManager automatically backs off and retries

5. **API Down**
   - Error: `SERVICE_UNAVAILABLE` (HTTP 503)
   - Handling: Circuit breaker opens, automatic retry with backoff

## Testing

### Test Container Numbers

For testing, use containers from real shipments you have access to.

**DO NOT** test with random container numbers - this wastes API quota.

### Validate Before Tracking

Always validate container numbers first:

```typescript
const validation = connector.validateContainerNumber('MAEU1234567')
if (!validation.valid) {
  // Don't even try to track
  console.error(validation.error)
  return
}
```

### Test Health Check

```bash
# In your code
const health = await connector.healthCheck()
console.log(health)
```

## Troubleshooting

### "API credentials not configured"

**Problem**: Environment variables not set

**Solution**:
```bash
# Create .env file
echo "MAERSK_CONSUMER_KEY=your_key" >> .env
echo "MAERSK_CLIENT_SECRET=your_secret" >> .env

# Restart application
```

### "Failed to get access token: HTTP 401"

**Problem**: Invalid credentials

**Solution**:
1. Go to https://developer.maersk.com/
2. Log in to your account
3. Go to "My Apps" → Your App
4. Verify Consumer Key and Secret
5. If needed, regenerate credentials

### "Container not found"

**Problem**: Container doesn't exist or wrong owner code

**Solution**:
1. Verify container number is correct
2. Check that owner code is Maersk (MAEU, MAER, etc.)
3. Container might not be in Maersk's system yet

### "HTTP 429 Too Many Requests"

**Problem**: Rate limit exceeded

**Solution**:
- RetryManager handles this automatically
- If persistent, reduce request rate
- Consider caching results

## Production Deployment

### Security

1. **Never commit credentials**:
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   ```

2. **Use environment variables**:
   - Production: Set in hosting platform (Vercel, AWS, etc.)
   - Development: Use `.env` file (git-ignored)

3. **Rotate credentials periodically**:
   - Every 90 days recommended
   - Immediately if compromised

### Monitoring

Monitor these metrics:

- **Success rate**: Should be >95%
- **Response time**: Usually <500ms
- **Error rate**: Track 401, 429, 503 errors
- **Circuit breaker state**: Should mostly be CLOSED

### Logging

All operations are logged with correlation IDs:

```json
{
  "timestamp": "2026-11-14T12:00:00.000Z",
  "level": "info",
  "module": "MaerskConnector",
  "operation": "track",
  "containerNumber": "MAEU1234567",
  "requestId": "maersk-1731588000000-abc123",
  "durationMs": 450,
  "status": "success"
}
```

**Note**: Container numbers are logged for debugging, but no sensitive credentials are ever logged.

## Cost

The Maersk Track & Trace Plus API is **FREE** for reasonable use.

There are no per-request charges.

Just register, subscribe, and use!

## Support

### Maersk Support

- **Developer Portal**: https://developer.maersk.com/
- **Documentation**: https://developer.maersk.com/api-catalogue/Track%20and%20Trace%20Plus
- **Support**: Use "Contact Us" on developer portal

### Technical Issues

1. Check health check endpoint
2. Review logs with correlation IDs
3. Check circuit breaker status
4. Verify credentials are current

## Migration from Website Scraping

If you were previously scraping the Maersk website:

### Before (Scraping)
```typescript
// Complex browser automation
// Fingerprint spoofing
// CAPTCHA challenges
// Frequent breakage
// Poor reliability
```

### After (API)
```typescript
const connector = new MaerskConnector()
const result = await connector.track('MAEU1234567')
// Simple, reliable, fast
```

### Benefits
- **10x faster** (no browser overhead)
- **10x more reliable** (official API)
- **Zero blocking** (no anti-bot challenges)
- **Better data** (structured, validated)
- **Legal compliance** (terms of service approved)

## Summary

✅ **Do**: Use MaerskConnector with official API  
❌ **Don't**: Try to bypass or scrape their website

The official API is free, fast, reliable, and legal. There's no reason to use anything else.

---

**Last Updated**: November 14, 2026  
**API Version**: Track & Trace Plus v1  
**Connector Version**: 1.0.0
