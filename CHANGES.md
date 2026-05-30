# Weather Chain - Changelog

All notable changes to the Weather Chain project.

## [Unreleased] - 2026-01-31

### Added

#### WebSocket Integration (Priority #1 from Analysis Report)
- **Real-time weather data streaming** via Tempest WebSocket API
- New `src/service/tempest-websocket.ts` - WebSocket client implementation
- New `src/service/stream.ts` - Streaming service with fallback mechanism
- Support for all Tempest message types:
  - `obs_air` - Air sensor observations
  - `obs_sky` - Sky sensor observations
  - `obs_st` - Storm sensor observations
  - `rapid_wind` - High-frequency wind updates (3s intervals)
  - `evt_strike` - Lightning strike events
  - `evt_precip` - Precipitation events

#### Management Interface
- **OpenClaw skill** for weather-chain management
- **Python CLI tool** (`skills/weather-chain/weather-chain`)
- Commands: status, stats, stream, queue, funding, config, monitor
- Real-time monitoring dashboard
- Comprehensive documentation (`SKILL.md`)

#### Configuration
- `.env.example` - Complete environment configuration template
- `STREAMING_MODE` option (websocket/polling/auto)
- WebSocket reconnection settings
- Security warnings and best practices

#### Documentation
- `WEBSOCKET.md` - Complete WebSocket integration guide
- `CHANGES.md` - This changelog file

### Improved

#### Data Latency
- **Before:** 5 minutes (polling at 300s intervals)
- **After:** ~1 second (WebSocket real-time streaming)
- Rapid wind updates available every 3 seconds

#### API Usage
- **Before:** ~12 requests/hour (continuous polling)
- **After:** Minimal (WebSocket push-based, no rate limits)
- Reduced API rate limit concerns

#### Error Handling
- Automatic fallback to polling on WebSocket failures
- Exponential backoff for reconnection attempts
- Graceful shutdown handling

#### Security
- Removed hardcoded private key from source code
- Added comprehensive `.env.example` with security notes
- Documented all configuration options

### Dependencies Added

```json
{
  "dependencies": {
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10"
  }
}
```

### Configuration Changes

New environment variables:

```bash
# Streaming mode: websocket, polling, or auto
STREAMING_MODE=auto
```

### Architecture Updates

```
Before:
  Tempest REST API → Queue → Processor → BSV

After:
  Tempest WebSocket (primary) ──┐
                               ├──→ Queue → Processor → BSV
  Tempest REST (fallback) ─────┘
```

### Performance Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Data latency | 5 min | 1 sec | **300x faster** |
| API calls/hour | 12 | ~0 | **100% reduction** |
| Rapid wind data | No | Yes (3s) | **New capability** |
| Event notifications | No | Yes | **New capability** |

## [0.1.0] - 2026-01-30

### Initial Release

- Basic polling service for Tempest weather data
- MongoDB queue for pending records
- BSV blockchain transaction encoding
- Funding basket management
- Docker containerization
- TypeScript implementation

---

## Migration Guide

### From 0.1.0 to Unreleased (WebSocket Integration)

#### 1. Update Dependencies

```bash
cd ~/projects/weather-chain
npm install
```

#### 2. Update Configuration

Add to your `.env` file:

```bash
# Add this line
STREAMING_MODE=auto
```

#### 3. (Optional) Remove Hardcoded Keys

If you previously had hardcoded values in source code, move them to `.env`:

```bash
# Copy example config
cp .env.example .env

# Edit with your values
nano .env
```

#### 4. Restart Service

```bash
# Stop existing service
npm stop  # or kill process

# Start with new configuration
npm start
```

#### 5. Verify

```bash
# Check status
weather-chain status

# Monitor streaming
weather-chain monitor
```

---

## Known Issues

### WebSocket Installation

If `npm install` fails for `ws`:

```bash
# Try installing manually
npm install --save ws @types/ws

# Or use yarn
yarn add ws @types/ws
```

### NAT/Firewall Issues

WebSocket requires outbound connection to `wss://ws.weatherflow.com:443`.

**Check connectivity:**
```bash
curl -I https://ws.weatherflow.com
```

**If blocked:** Use polling mode instead:
```bash
weather-chain stream polling
```

### Auto-Fallback Not Working

Ensure `STREAMING_MODE=auto` in `.env` and restart service.

---

## Future Plans

### High Priority

- [ ] Bulk write optimization for MongoDB (fix N+1 query problem)
- [ ] Circuit breaker pattern for external API calls
- [ ] Connection pooling for MongoDB
- [ ] Health checks in Docker container

### Medium Priority

- [ ] Multi-station support
- [ ] Prometheus metrics integration
- [ ] HTTP API for monitoring
- [ ] WebSocket message persistence

### Low Priority

- [ ] Protocol buffers for schema evolution
- [ ] Event sourcing pattern
- [ ] Data deduplication mechanism

---

## Support

For issues or questions:

1. Check documentation:
   - `README.md` - Project overview
   - `WEBSOCKET.md` - WebSocket integration guide
   - `SKILL.md` (in OpenClaw skills) - CLI reference

2. Run diagnostics:
   ```bash
   weather-chain status
   ```

3. Check logs:
   ```bash
   tail -f ~/projects/weather-chain/weather-chain.log
   ```

---

*Changelog maintained by LexDex*
