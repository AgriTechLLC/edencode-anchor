# WebSocket Integration Guide

This document explains the WebSocket integration for the Weather Chain system, providing real-time weather data streaming from Tempest stations.

## Overview

The Weather Chain system now supports two data ingestion modes:

1. **WebSocket Mode** (Recommended) - Real-time data streaming
2. **Polling Mode** - REST API polling with configurable intervals

## WebSocket Integration

### What's New

- **Real-time observations** (~1 minute intervals)
- **Rapid wind updates** (~3 second intervals)
- **Event notifications** (lightning strikes, precipitation events)
- **Reduced API calls** - No rate limit concerns
- **Automatic fallback** - Falls back to polling on WebSocket failures

### Files Added

```
src/service/
├── tempest-websocket.ts    # WebSocket client implementation
└── stream.ts               # Streaming service with fallback
```

### Files Modified

```
src/config/env.ts           # Added STREAMING_MODE
package.json                # Added ws dependency
.env.example               # Added streaming configuration
```

## Configuration

Add to your `.env` file:

```bash
# Streaming mode: websocket, polling, or auto
STREAMING_MODE=auto
```

### Mode Options

| Mode | Description | Best For |
|------|-------------|----------|
| `websocket` | Always use WebSocket | Production, real-time needs |
| `polling` | Always use REST polling | Testing, backup |
| `auto` | Try WebSocket, fall back to polling | Flexible deployment |

## WebSocket Message Types

The Tempest WebSocket API sends multiple message types:

### Observations

- **obs_air** - Air sensor (temperature, pressure, humidity, wind)
- **obs_sky** - Sky sensor (brightness, UV, solar radiation, rain)
- **obs_st** - Storm sensor (if installed)

### Events

- **rapid_wind** - High-frequency wind updates (3s intervals)
- **evt_strike** - Lightning strike event
- **evt_precip** - Precipitation event (start/stop)

### Observation Data Mapping

Each observation is mapped to the standard `WeatherData` format:

```typescript
{
  station_id: number,
  timestamp: ISO string,
  timestamp_epoch: number,
  air_temperature: number,      // °C
  pressure: number,             // mbar
  relative_humidity: number,    // %
  wind_avg: number,             // m/s
  wind_direction: number,       // degrees
  wind_gust: number,            // m/s
  // ... 30+ weather fields
}
```

## WebSocket Client Features

### Auto-Reconnection

The WebSocket client automatically reconnects with exponential backoff:

- Initial delay: 5 seconds
- Max attempts: 10
- Backoff factor: 1.5x
- Max delay: ~1 minute after 10 attempts

### Error Handling

- Connection errors logged and reported
- Fallback to polling after 5 consecutive errors
- Graceful shutdown on SIGTERM/SIGINT

### Statistics Tracking

The streaming service tracks:

- Total observations received
- Rapid wind updates
- Event notifications
- Errors count
- Connection uptime
- Last observation time

## Usage

### With the Management Skill

```bash
# Set streaming mode to WebSocket
weather-chain stream websocket

# Set to polling (fallback)
weather-chain stream polling

# Enable auto mode
weather-chain stream auto

# Check current status
weather-chain status
```

### Programmatically

```typescript
import { startStreamingService, stopStreamingService } from './service/stream';

// Start streaming (WebSocket or auto)
await startStreamingService(notification);

// Stop streaming
stopStreamingService();

// Get statistics
const stats = getStreamingStats();
console.log(`Observations: ${stats.observationsReceived}`);
```

## API Comparison

### WebSocket (Real-time)

| Metric | Value |
|--------|-------|
| Latency | Seconds |
| Standard obs | ~1 minute |
| Rapid wind | ~3 seconds |
| API rate limits | None |
| Bandwidth | Low (push-based) |
| Battery usage | Low (push-based) |

### Polling (Fallback)

| Metric | Value (default) |
|--------|-----------------|
| Latency | 5 minutes |
| Standard obs | 5 minutes |
| Rapid wind | Not available |
| API rate limits | ~15 requests/min |
| Bandwidth | Higher (pull-based) |
| Battery usage | Higher (pull-based) |

## Architecture

```
┌─────────────────┐
│  Tempest API    │
│  WebSocket     │◄───────────┐
└────────┬────────┘            │
         │                     │
         │ wss://              │
         │                     │
┌────────▼────────┐      ┌────▼─────┐
│  WebSocket      │      │  Polling │
│  Client         │      │  Service │
└────────┬────────┘      └────┬─────┘
         │                    │
         │        Streaming    │
         │        Service      │
         └─────────┬──────────┘
                   │
                   │ Queue to MongoDB
                   ▼
         ┌──────────────────┐
         │  Queue Manager   │
         └────────┬─────────┘
                  │
         ┌────────▼──────────┐
         │  Transaction     │
         │  Processor      │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │  BSV Blockchain  │
         └─────────────────┘
```

## Troubleshooting

### WebSocket Won't Connect

1. **Check API token:**
   ```bash
   weather-chain config get TEMPEST_API_KEY
   ```

2. **Verify station ID:**
   ```bash
   # Check Tempest dashboard for your station ID
   # Or use the REST API to list stations
   ```

3. **Check firewall:**
   - Ensure outbound connections to `wss://ws.weatherflow.com` are allowed
   - Port 443 (HTTPS/WSS) must be open

4. **Check logs:**
   ```bash
   tail -f ~/projects/weather-chain/weather-chain.log
   ```

### Frequent Disconnections

1. **Network instability:** WebSocket requires stable connection
2. **API token expired:** Refresh your Tempest API token
3. **Rate limiting:** Tempest may throttle on connection storms

**Solution:** Use `STREAMING_MODE=auto` for automatic fallback to polling.

### High Memory Usage

WebSocket maintains a connection buffer. Monitor with:

```bash
# Check process memory
ps aux | grep node

# Use monitoring dashboard
weather-chain monitor
```

## Performance Optimization

### Reduce Observations

If you're receiving too many observations:

1. **Filter at the source:**
   - Configure filters in Tempest dashboard
   - Disable unwanted message types

2. **Batch processing:**
   - Increase `PROCESSOR_INTERVAL` in `.env`
   - Larger batches reduce transaction count

3. **Selective recording:**
   - Only queue observations that meet thresholds
   - Skip rapid wind updates if not needed

### Optimize Transaction Batching

Adjust in `.env`:

```bash
# More outputs per transaction = lower fees
WEATHER_OUTPUTS_PER_TX=100

# Larger batch = more risk if transaction fails
WEATHER_OUTPUTS_PER_TX=500
```

## Security Considerations

### WebSocket Security

- **WSS protocol** - Uses TLS encryption
- **No credentials in URL** - Uses separate authentication
- **Origin validation** - Tempest validates connection origin

### Rate Limiting

Tempest WebSocket has **no rate limits**, but:
- Don't create multiple connections per station
- Respect API terms of service
- Implement your own throttling if needed

### Data Validation

All WebSocket data is validated before queueing:

- Schema validation for observation types
- Range checks for values (temperature, pressure, etc.)
- Timestamp validation (reject stale/future data)

## Monitoring

### Real-time Monitoring

```bash
# Start monitoring dashboard
weather-chain monitor
```

### Prometheus Metrics

Enable in `.env`:

```bash
ENABLE_METRICS=true
METRICS_PORT=9090
```

Available metrics:

- `weather_chain_ws_connected` - WebSocket connection status (0/1)
- `weather_chain_observations_total` - Total observations received
- `weather_chain_rapid_wind_total` - Rapid wind updates
- `weather_chain_events_total` - Event notifications by type
- `weather_chain_ws_errors_total` - WebSocket errors

### Log Analysis

Key log messages:

```
[Stream] ✓ WebSocket connected
[Stream] Queued observation: 2026-01-31T02:00:00Z
[Stream] Rapid wind update: 5.2 m/s
[Stream] Event: evt_strike
[Stream] Too many errors, falling back to polling...
```

## Future Enhancements

Potential improvements:

1. **Multi-station support** - Listen to multiple stations simultaneously
2. **Data filtering** - Filter observations before queueing
3. **Custom thresholds** - Only queue when conditions change significantly
4. **Message persistence** - Cache WebSocket messages during disconnections
5. **Observation aggregation** - Batch rapid wind updates

## References

- **Tempest WebSocket API:** https://weatherflow.github.io/Tempest/api/swagger.html
- **WS Library:** https://github.com/websockets/ws
- **Analysis Report:** See `ANALYSIS_REPORT.md` for detailed research

## Support

For issues or questions:

1. Check logs: `~/projects/weather-chain/weather-chain.log`
2. Run diagnostics: `weather-chain status`
3. See main README: `~/projects/weather-chain/README.md`

---

*WebSocket integration implemented 2026-01-31 by LexDex*
