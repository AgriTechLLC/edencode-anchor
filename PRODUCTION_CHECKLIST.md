# Weather Chain - Production Checklist

Use this checklist to ensure your Weather Chain deployment is production-ready.

---

## Pre-Deployment Checklist

### Account Setup

- [ ] **WeatherFlow Account**
  - [ ] Created account at https://tempestwx.com
  - [ ] Added/verified Tempest station
  - [ ] Generated API token
  - [ ] Copied station ID

- [ ] **MongoDB**
  - [ ] Created MongoDB Atlas account or installed locally
  - [ ] Created database user with read/write permissions
  - [ ] Configured IP whitelist (for cloud)
  - [ ] Tested connection string

- [ ] **BSV Wallet**
  - [ ] Generated secure private key (64 hex characters)
  - [ ] Stored private key securely (not in code)
  - [ ] Verified key format: `openssl rand -hex 32`
  - [ ] Noted network (testnet vs mainnet)

### System Requirements

- [ ] Node.js 18+ installed
  ```bash
  node --version
  ```
- [ ] MongoDB installed and running
  ```bash
  mongosh --eval "db.version()"
  ```
- [ ] Git installed (for cloning)
- [ ] At least 1GB disk space available
- [ ] At least 512MB RAM available

---

## Configuration Checklist

### Environment File

- [ ] Copied `.env.example` to `.env`
- [ ] Set `SERVER_PRIVATE_KEY` (64 hex chars)
- [ ] Set `TEMPEST_API_KEY`
- [ ] Set `TEMPEST_STATION_ID`
- [ ] Set `MONGO_URI` (correct connection string)
- [ ] Set `BSV_NETWORK` (test/main)
- [ ] Set `STREAMING_MODE` (websocket/polling/auto)
- [ ] Set `FUNDING_OUTPUT_AMOUNT` (e.g., 1000 satoshis)
- [ ] Set `FUNDING_BASKET_MIN` (e.g., 200 outputs)
- [ ] Set `WEATHER_OUTPUTS_PER_TX` (e.g., 100)
- [ ] Set `LOG_LEVEL` (info/warn/error)

### Validation

- [ ] Configuration is valid
  ```bash
  weather-chain config validate
  ```

---

## Installation Checklist

### Dependencies

- [ ] Installed Node.js dependencies
  ```bash
  npm install
  ```

- [ ] WebSocket library installed
  ```bash
  npm list ws
  ```

### Build

- [ ] TypeScript compiled successfully
  ```bash
  npm run build
  ```

### Funding Setup

- [ ] Funding basket initialized
  ```bash
  npm run setup
  ```

- [ ] Wallet balance verified
  ```bash
  weather-chain funding balance
  ```

- [ ] Funding outputs created
  ```bash
  weather-chain funding status
  ```

---

## Deployment Checklist

### Service Start

- [ ] Service starts without errors
  ```bash
  npm start
  ```

- [ ] All services initialized:
  - [ ] MongoDB connected
  - [ ] Wallet initialized
  - [ ] WebSocket connected (if streaming mode)
  - [ ] Funding basket ready

### Status Verification

- [ ] Service status is "Running"
  ```bash
  weather-chain status
  ```

- [ ] Streaming mode correct
  ```bash
  weather-chain status | grep "Streaming"
  ```

- [ ] Observations received
  ```bash
  weather-chain stats | grep "Observations"
  ```

---

## Functional Testing Checklist

### WebSocket Connection

- [ ] WebSocket connects successfully
- [ ] No connection errors in logs
- [ ] Auto-reconnection works (if testing network interruption)

### Data Flow

- [ ] Weather observations being received
  ```bash
  weather-chain stats | grep "Observations"
  ```

- [ ] Queue items being processed
  ```bash
  weather-chain queue stats
  ```

- [ ] Transactions being created
  ```bash
  weather-chain stats | grep "Transactions"
  ```

### CLI Commands

- [ ] `weather-chain status` works
- [ ] `weather-chain stats` works
- [ ] `weather-chain funding status` works
- [ ] `weather-chain queue stats` works
- [ ] `weather-chain monitor` works

### Mode Switching

- [ ] Switch to polling mode works
  ```bash
  weather-chain stream polling
  ```

- [ ] Switch back to WebSocket works
  ```bash
  weather-chain stream websocket
  ```

---

## Production Hardening Checklist

### Security

- [ ] `.env` file has restrictive permissions
  ```bash
  chmod 600 .env
  ```

- [ ] `.env` is in `.gitignore`
  ```bash
  echo ".env" >> .gitignore
  ```

- [ ] Private key not committed to version control
- [ ] API tokens stored securely
- [ ] MongoDB credentials not hardcoded in scripts

### Process Management

- [ ] PM2 installed (if using PM2)
  ```bash
  npm install -g pm2
  ```

- [ ] Service configured with PM2/systemd
  ```bash
  pm2 start dist/app.js --name "weather-chain"
  pm2 startup
  pm2 save
  ```

- [ ] Auto-restart enabled
- [ ] Service survives reboot

### Logging

- [ ] Log file rotation configured (optional)
- [ ] Log level set appropriately (info for production)
- [ ] Log directory has sufficient space

### Monitoring

- [ ] Prometheus metrics enabled (optional)
  ```bash
  ENABLE_METRICS=true
  METRICS_PORT=9090
  ```

- [ ] Health check endpoint accessible
  ```bash
  curl http://localhost:3000/health
  ```

- [ ] Alerting configured (if using monitoring system)

---

## Documentation Checklist

- [ ] DEPLOYMENT.md read and understood
- [ ] QUICKSTART.md reviewed
- [ ] WEBSOCKET.md reviewed for streaming details
- [ ] Emergency contacts documented
- [ ] Runbook created for common issues

---

## Pre-Launch Final Checklist

### One-Hour Before Launch

- [ ] Verify all configuration is correct
- [ ] Check MongoDB connection is stable
- [ ] Verify WebSocket is connected
- [ ] Check funding basket has sufficient outputs (above minimum)
- [ ] Review recent logs for errors
- [ ] Confirm monitoring is running

### Go-Live Verification

- [ ] Service is running
  ```bash
  weather-chain status
  ```

- [ ] Observations are streaming
  ```bash
  weather-chain stats
  ```

- [ ] Transactions are being processed
  ```bash
  weather-chain stats | grep "Transactions"
  ```

- [ ] No errors in logs
  ```bash
  tail -50 weather-chain.log | grep -i error
  ```

- [ ] Funding basket above minimum
  ```bash
  weather-chain funding status
  ```

---

## Daily Operations Checklist

### Every Day

- [ ] Check service status
  ```bash
  weather-chain status
  ```

- [ ] Review statistics
  ```bash
  weather-chain stats
  ```

- [ ] Check funding basket level
  ```bash
  weather-chain funding status
  ```

- [ ] Verify no errors in logs

### Every Week

- [ ] Review error logs for patterns
- [ ] Check MongoDB storage usage
- [ ] Verify funding basket balance
- [ ] Check for software updates

### Every Month

- [ ] Rotate private key (optional security practice)
- [ ] Review and clean old log files
- [ ] Check MongoDB indexes
- [ ] Verify backup restoration (test)

---

## Emergency Procedures

### Service Not Responding

```bash
# Check if process is running
weather-chain status

# Check for errors
tail -100 weather-chain.log

# Restart service
pm2 restart weather-chain
# or
sudo systemctl restart weather-chain
```

### Funding Basket Depleted

```bash
# Check balance
weather-chain funding balance

# Refill basket
weather-chain funding refill

# If balance is zero, send BSV to wallet address
```

### WebSocket Disconnecting Frequently

```bash
# Switch to polling mode as fallback
weather-chain stream polling

# Check network connectivity
curl -I https://ws.weatherflow.com

# Review logs
tail -f weather-chain.log | grep -i websocket
```

### High Error Rate

```bash
# Check error statistics
weather-chain stats | grep -i error

# View detailed errors
tail -100 weather-chain.log | grep ERROR

# Common fixes:
# - Restart service
# - Refill funding basket
# - Switch to polling mode
# - Verify API credentials
```

---

## Rollback Checklist

### If Deployment Fails

1. [ ] Stop the new service
2. [ ] Restore previous configuration
3. [ ] Restart with previous version
4. [ ] Verify service is stable
5. [ ] Document the issue

```bash
# Stop current service
pm2 stop weather-chain

# Restore previous version
git checkout <previous-commit>
npm install
npm run build
npm run setup

# Restart
pm2 restart weather-chain
```

---

## Sign-Off

### Deployment Engineer

- [ ] Name: ____________________
- [ ] Date: ____________________
- [ ] Signature: ____________________

### Operations Team

- [ ] Notified of deployment: Yes/No
- [ ] Monitoring active: Yes/No
- [ ] Documentation updated: Yes/No

---

## Quick Command Reference

### Status & Monitoring

```bash
# Check status
weather-chain status

# View statistics
weather-chain stats

# Real-time monitoring
weather-chain monitor

# Check funding
weather-chain funding status

# Check queue
weather-chain queue stats
```

### Service Control

```bash
# Restart service (PM2)
pm2 restart weather-chain

# View logs
pm2 logs weather-chain

# Check logs
tail -f weather-chain.log
```

### Configuration

```bash
# Show config
weather-chain config show

# Validate config
weather-chain config validate

# Get specific value
weather-chain config get TEMPEST_API_KEY
```

### Troubleshooting

```bash
# Full diagnostic
echo "=== Config ===" && weather-chain config show
echo "=== Status ===" && weather-chain status
echo "=== Stats ===" && weather-chain stats
echo "=== Funding ===" && weather-chain funding status
echo "=== Queue ===" && weather-chain queue stats
```

---

*Last updated: 2026-01-31*
*Weather Chain Version: 0.1.0*
