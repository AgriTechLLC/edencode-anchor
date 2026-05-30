# Weather Chain - Quick Start Guide

Get real-time weather data onto the BSV blockchain in minutes.

## What Is It?

Weather Chain is a BSV blockchain service that captures real-time weather data from WeatherFlow Tempest stations and stores it immutably on the blockchain.

### Key Features

- **Real-time streaming**: WebSocket integration for <1 second data latency
- **Auto-fallback**: Falls back to polling if WebSocket fails
- **Blockchain storage**: Immutable weather records on BSV
- **Management CLI**: Full control over the service
- **Statistics tracking**: Observations, transactions, errors, uptime

## Prerequisites

- Node.js 18+
- WeatherFlow Tempest API token
- MongoDB instance
- BSV wallet for transaction funding

## Installation

```bash
cd ~/projects/weather-chain
npm install
```

## Configuration

1. **Copy environment template:**
```bash
cp .env.example .env
```

2. **Edit `.env` with your settings:**

```bash
# WeatherFlow API
TEMPEST_API_KEY=your_api_token_here
TEMPEST_STATION_ID=your_station_id

# MongoDB
MONGODB_URI=mongodb://localhost:27017/weather-chain

# BSV Network
NETWORK=testnet  # or mainnet for production
PRIVATE_KEY=your_private_key_here

# Streaming Mode (NEW)
STREAMING_MODE=websocket  # Options: websocket, polling, auto

# Polling Rate (fallback)
POLL_RATE=300  # Seconds (5 minutes default)
```

## Starting the Service

```bash
npm start
```

You should see:
```
============================================================
Weather Chain - BSV Blockchain Weather Data Service
============================================================
Validating configuration...
✓ Configuration valid
Connecting to MongoDB...
✓ Connected to MongoDB
Initializing wallet...
✓ Wallet initialized
Checking funding basket...
✓ Funding basket ready
============================================================
Starting services...
Mode: WebSocket (real-time)
Found 1 station(s)
Initializing WebSocket client...
[Stream] ✓ WebSocket connected
✓ All services started
============================================================
Application running in streaming mode. Press Ctrl+C to stop.
```

## Management CLI

The `weather-chain` CLI provides full control over the service.

### Check Status
```bash
weather-chain status
```

Output:
```
=== Weather Chain Status ===
Configuration: ✓ Valid
Service Status: Running
Streaming Mode: WebSocket (Connected)
MongoDB: Connected
BSV Network: testnet
```

### View Statistics
```bash
weather-chain stats
```

Output:
```
=== Statistics ===
Observations Received: 1,234
Transactions Written: 1,230
Failed Transactions: 4
Errors Count: 2

Uptime: 2h 15m 30s
Last Observation: 2026-01-31 04:15:32

Observation Timeline:
- Last 5 min: 156 obs
- Last 15 min: 467 obs
- Last 1 hr: 1,842 obs
- Total: 1,234 obs
```

### Control Streaming Mode
```bash
# Switch to polling
weather-chain stream polling

# Switch to WebSocket
weather-chain stream websocket

# Switch to auto (tries WebSocket, falls back to polling)
weather-chain stream auto
```

### Queue Management
```bash
# Queue statistics
weather-chain queue stats

# Clear failed transactions
weather-chain queue clear

# Reset queue (use with caution)
weather-chain queue reset
```

### Funding Management
```bash
# Check funding basket
weather-chain funding status

# Refill funding basket
weather-chain funding refill

# Check wallet balance
weather-chain funding balance
```

### Configuration
```bash
# Show current configuration
weather-chain config show

# Validate configuration
weather-chain config validate

# Get specific config value
weather-chain config get TEMPEST_API_KEY
```

### Real-time Monitoring
```bash
weather-chain monitor
```

Shows live dashboard with streaming updates.

## Architecture

```
WeatherFlow Tempest Station
         ↓
    WebSocket Client
         ↓
    Streaming Service
    (with fallback)
         ↓
    MongoDB Queue
         ↓
    Processor Loop
         ↓
    BSV Blockchain
```

## Streaming vs Polling

### WebSocket Mode (Recommended)
- **Latency**: <1 second
- **API calls**: ~0/hour
- **Rapid wind**: 3-second intervals
- **Best for**: Real-time applications

### Polling Mode (Fallback)
- **Latency**: 5 minutes (configurable)
- **API calls**: 12/hour at default rate
- **Best for**: Cost-sensitive applications

### Auto Mode
- Tries WebSocket first
- Falls back to polling after 5+ errors
- Automatic recovery to WebSocket

## Troubleshooting

### WebSocket Not Connecting

```bash
# Check streaming status
weather-chain status

# Switch to polling to verify API works
weather-chain stream polling
```

### MongoDB Connection Failed

Check your `MONGODB_URI` and ensure MongoDB is running:
```bash
mongosh --eval "db.version()"
```

### Funding Basket Empty

```bash
# Check balance
weather-chain funding balance

# Refill basket
weather-chain funding refill
```

### High Error Rate

```bash
# View statistics
weather-chain stats

# Check logs for details
npm start 2>&1 | tee weather-chain.log
```

## Production Deployment

For comprehensive production deployment instructions, including:

- **Prerequisites** - Accounts needed (WeatherFlow, MongoDB, BSV wallet)
- **Step-by-step configuration** - Environment setup with real credentials
- **Credential generation** - Secure private key generation
- **Deployment options** - Local, server, Docker, and cloud deployments
- **Testing checklist** - Verify your deployment is working
- **Monitoring & maintenance** - Ongoing operations guide
- **Troubleshooting** - Common issues and solutions

**👉 Read the complete guide: [DEPLOYMENT.md](./DEPLOYMENT.md)**

For a quick checklist of production-readiness items, see: [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)

### Quick Production Setup

```bash
# 1. Configure credentials
cp .env.example .env
nano .env  # Add your API key, private key, MongoDB URI

# 2. Build and setup
npm install && npm run build
npm run setup

# 3. Start with process manager (PM2 recommended)
npm install -g pm2
pm2 start dist/app.js --name "weather-chain"
pm2 startup
pm2 save
```

## Next Steps

- 📖 **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete production deployment guide
- ✅ **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - Deployment checklist
- 📡 Read [WEBSOCKET.md](./WEBSOCKET.md) for detailed WebSocket documentation
- 📋 Read [CHANGES.md](./CHANGES.md) for changelog and migration guide
- 🔧 Check [skills/weather-chain/SKILL.md](../.openclaw/workspace/skills/weather-chain/SKILL.md) for OpenClaw integration

## Support

For issues or questions:
- Check documentation in `docs/` folder
- Review error logs
- Check WebSocket connection status

---

**Weather Chain** - Real-time weather data, immutably stored on BSV blockchain.
