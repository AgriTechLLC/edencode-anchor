# Weather Chain - Production Deployment Guide

This guide provides step-by-step instructions for deploying Weather Chain in production with real credentials. Follow this guide to set up your WeatherFlow Tempest station data streaming to the BSV blockchain.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Account Setup](#account-setup)
- [Environment Configuration](#environment-configuration)
- [Credential Generation](#credential-generation)
- [Deployment Options](#deployment-options)
- [Initial Setup](#initial-setup)
- [Testing Checklist](#testing-checklist)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts & Services

| Service | Purpose | Signup URL |
|---------|---------|------------|
| WeatherFlow Tempest | Weather data source | https://tempestwx.com/ |
| MongoDB | Data queue & storage | https://www.mongodb.com/ |
| BSV Wallet | Transaction funding | See options below |

### System Requirements

- **Node.js**: Version 18 or higher
- **Operating System**: macOS, Linux, or Linux-based server
- **Disk Space**: At least 1GB for MongoDB + logs
- **Memory**: Minimum 512MB RAM (1GB+ recommended)
- **Network**: Outbound HTTPS/WebSocket access to:
  - `api.tempestwx.com` (REST API)
  - `ws.weatherflow.com` (WebSocket)
  - BSV network nodes

---

## Account Setup

### 1. WeatherFlow Tempest Account

1. **Create Account**: Go to https://tempestwx.com/signup
2. **Add Your Station**: If you don't have a physical station, you can use a demo station or purchase one
3. **Generate API Token**:
   - Navigate to: https://tempestwx.com/settings/tokens
   - Click "Create Token"
   - Give it a descriptive name (e.g., "Weather Chain Production")
   - Copy and save the token securely
   - **Note**: You'll need both the token AND your station ID

4. **Find Your Station ID**:
   - Go to https://tempestwx.com/stations
   - Click on your station
   - The station ID is in the URL: `tempestwx.com/station/{STATION_ID}`
   - Or check the station dashboard

### 2. MongoDB Setup

#### Option A: MongoDB Atlas (Cloud - Recommended for Production)

1. **Create Account**: https://www.mongodb.com/atlas/database
2. **Create Free Cluster**: Choose AWS/GCP/Azure free tier
3. **Create Database User**:
   - Database Access → Add New User
   - Username: `weather-chain`
   - Password: Generate strong password, save it
   - Role: `Read and Write to any database`
4. **Network Access**:
   - Network Access → Add IP Address
   - For production: Add your server's static IP
   - For testing: Use `0.0.0.0/0` (not recommended for production)
5. **Get Connection String**:
   - Database → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your database user's password
   - Format: `mongodb+srv://weather-chain:<password>@cluster0.xxxxx.mongodb.net/weather-chain?authSource=admin`

#### Option B: Self-Hosted MongoDB

```bash
# macOS with Homebrew
brew install mongodb-community
brew services start mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb
sudo systemctl start mongodb

# Verify installation
mongosh --eval "db.version()"
```

### 3. BSV Wallet Setup

#### Option A: BSV Toolkit Wallet (Recommended)

The project uses the BSV Toolkit wallet service. Configure in `.env`:

```bash
WALLET_STORAGE_URL=https://store-us-1.bsvb.tech
```

#### Option B: Local BSV Wallet

For advanced users, you can run a local wallet. See BSV SDK documentation.

---

## Environment Configuration

### Step 1: Copy Environment Template

```bash
cd ~/projects/weather-chain
cp .env.example .env
```

### Step 2: Configure Credentials

Edit `.env` with your values:

```bash
# ============================================
# WALLET CONFIGURATION (CRITICAL - SECURITY)
# ============================================

# Private key for server wallet
# ⚠️ NEVER share this key or commit to version control
# Generate secure key: openssl rand -hex 32
SERVER_PRIVATE_KEY=your_private_key_here

# Wallet storage URL
WALLET_STORAGE_URL=https://store-us-1.bsvb.tech

# BSV Network: main or test
BSV_NETWORK=main  # Use 'test' for testing

# ============================================
# TEMPEST API CONFIGURATION
# ============================================

TEMPEST_API_KEY=your_tempest_api_key_here

# Streaming mode: websocket (recommended), polling, or auto
STREAMING_MODE=websocket

# Polling interval (seconds) - only used in polling mode
POLL_RATE=300

# ============================================
# MONGODB CONFIGURATION
# ============================================

# Local development:
# MONGO_URI=mongodb://localhost:27017/weather-chain

# MongoDB Atlas (cloud):
# MONGO_URI=mongodb+srv://weather-chain:<password>@cluster0.xxxxx.mongodb.net/weather-chain?authSource=admin

MONGO_URI=mongodb://localhost:27017/weather-chain

# ============================================
# FUNDING BASKET CONFIGURATION
# ============================================

FUNDING_OUTPUT_AMOUNT=1000      # Satoshis per output
FUNDING_BASKET_MIN=200          # Minimum outputs to maintain
FUNDING_BATCH_SIZE=1000         # Outputs to create when refilling

# ============================================
# TRANSACTION CONFIGURATION
# ============================================

WEATHER_OUTPUTS_PER_TX=100      # Outputs per transaction

# ============================================
# SERVICE CONFIGURATION
# ============================================

MONITOR_INTERVAL=60             # Funding check interval (seconds)
PROCESSOR_INTERVAL=3            # Queue processor interval (seconds)

# ============================================
# OPTIONAL: ADVANCED
# ============================================

LOG_LEVEL=info                  # debug, info, warn, error
# ENABLE_METRICS=true
# METRICS_PORT=9090
# WS_MAX_RECONNECT_ATTEMPTS=10
# WS_INITIAL_RECONNECT_DELAY=5000
```

### Step 3: Validate Configuration

```bash
# Using the management CLI
weather-chain config validate

# Expected output:
# ✓ Configuration valid
```

---

## Credential Generation

### Generate Secure Private Key

**⚠️ Important Security Notes:**

- Never share your private key
- Never commit `.env` to version control
- Back up your private key in a secure location
- Use a different key for testnet vs mainnet

#### Method 1: OpenSSL (Recommended)

```bash
# Generate a secure 32-byte (256-bit) key
openssl rand -hex 32

# Example output (DO NOT USE THIS):
# 8f3b2c1e4d5a6f7890a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3
```

#### Method 2: Node.js

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Method 3: BSV Wallet Generate

```bash
# Using BSV Toolkit (if available)
bsv-wallet-toolbox keygen
```

### Get Your Station ID

```bash
# Method 1: From Tempest Dashboard
# Go to https://tempestwx.com/stations
# Your station ID is displayed on the station page

# Method 2: Using API (replace YOUR_API_TOKEN)
curl -H "Authorization: YOUR_API_TOKEN" \
  https://api.tempestwx.com/stations

# Example response:
# {"stations":[{"id":12345,"name":"My Station",...}]}
```

---

## Deployment Options

### Option 1: Local Development (Quick Start)

Best for testing and development.

```bash
# 1. Ensure MongoDB is running
mongod --dbpath /path/to/data

# 2. Navigate to project
cd ~/projects/weather-chain

# 3. Install dependencies
npm install

# 4. Build TypeScript
npm run build

# 5. Setup funding basket
npm run setup

# 6. Start the service
npm start

# 7. In another terminal, check status
weather-chain status
```

### Option 2: Production Server (Systemd)

Best for dedicated Linux servers.

```bash
# 1. SSH into your server
ssh user@your-server.com

# 2. Install dependencies
sudo apt-get update
sudo apt-get install -y nodejs npm git

# 3. Clone and setup project
git clone https://github.com/yourusername/weather-chain.git
cd weather-chain
npm install
npm run build

# 4. Create .env file
sudo nano .env  # Add your credentials

# 5. Setup funding basket
npm run setup

# 6. Create systemd service
sudo nano /etc/systemd/system/weather-chain.service
```

**Systemd Service File:**
```ini
[Unit]
Description=Weather Chain - BSV Blockchain Weather Data Service
After=network.target mongod.service

[Service]
Type=simple
User=weather-chain
WorkingDirectory=/home/weather-chain
ExecStart=/usr/bin/node dist/app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/home/weather-chain/.env

[Install]
WantedBy=multi-user.target
```

```bash
# 7. Enable and start service
sudo systemctl enable weather-chain
sudo systemctl start weather-chain

# 8. Check status
sudo systemctl status weather-chain

# 9. View logs
sudo journalctl -u weather-chain -f
```

### Option 3: Docker Deployment

Best for containerized deployments.

```bash
# 1. Create .env file
cd ~/projects/weather-chain
cp .env.example .env
nano .env  # Configure credentials

# 2. Start with docker-compose
docker-compose up -d

# 3. View logs
docker-compose logs -f

# 4. Stop service
docker-compose down
```

**docker-compose.yml already exists in the project.**

### Option 4: Cloud Platforms

#### Railway

1. Connect your GitHub repository
2. Add environment variables in Railway dashboard
3. Add MongoDB service (or use Atlas)
4. Deploy

#### Render

1. Create new Web Service
2. Connect GitHub repository
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add environment variables
6. Deploy

#### AWS EC2

1. Launch EC2 instance (Ubuntu recommended)
2. Install Docker or Node.js
3. Configure security groups (ports 22, 3000)
4. Deploy using Option 2 or 3

---

## Initial Setup

### Step 1: Build the Project

```bash
cd ~/projects/weather-chain
npm install          # Install dependencies
npm run build        # Compile TypeScript
```

### Step 2: Configure Credentials

Ensure `.env` has all required values:

```bash
# Verify all values are set (except SERVER_PRIVATE_KEY)
weather-chain config show

# Check critical settings
weather-chain config get TEMPEST_API_KEY
weather-chain config get MONGO_URI
weather-chain config get BSV_NETWORK
```

### Step 3: Setup Funding Basket

```bash
npm run setup

# Expected output:
# ✓ Wallet initialized
# ✓ Current balance: XXXXX satoshis
# ✓ Created 1000 funding outputs
# ✓ Funding basket ready
```

### Step 4: Start the Service

```bash
# Option A: Direct start (for testing)
npm start

# Option B: Using PM2 (recommended for production)
npm install -g pm2
pm2 start dist/app.js --name "weather-chain"
pm2 startup
pm2 save

# Option C: Using systemd (see Option 2 above)
```

### Step 5: Verify Service is Running

```bash
weather-chain status

# Expected output:
# === Weather Chain Status ===
# Configuration: ✓ Valid
# Service Status: Running
# Streaming Mode: WebSocket (Connected)
# MongoDB: Connected
# BSV Network: main
```

---

## Testing Checklist

Use this checklist to verify your deployment is working correctly.

### Pre-Flight Checks

- [ ] Node.js version is 18+
  ```bash
  node --version
  ```

- [ ] MongoDB is accessible
  ```bash
  mongosh --eval "db.version()"
  ```

- [ ] Configuration is valid
  ```bash
  weather-chain config validate
  ```

- [ ] Tempest API token is correct
  ```bash
  curl -H "Authorization: $TEMPEST_API_KEY" \
    https://api.tempestwx.com/stations
  ```

### Functional Tests

- [ ] Service starts without errors
  ```bash
  npm start 2>&1 | head -20
  ```

- [ ] WebSocket connects successfully
  ```bash
  weather-chain status | grep "WebSocket"
  ```

- [ ] MongoDB connection works
  ```bash
  weather-chain status | grep "MongoDB"
  ```

- [ ] Funding basket has minimum outputs
  ```bash
  weather-chain funding status
  ```

- [ ] First observation is received
  ```bash
  weather-chain stats | grep "Observations"
  ```

### Advanced Tests

- [ ] Transaction is created and broadcast
  ```bash
  weather-chain stats | grep "Transactions"
  ```

- [ ] Queue processing works
  ```bash
  weather-chain queue stats
  ```

- [ ] Streaming mode switches correctly
  ```bash
  weather-chain stream polling
  weather-chain status | grep "Polling"
  weather-chain stream websocket
  weather-chain status | grep "WebSocket"
  ```

- [ ] Monitoring dashboard works
  ```bash
  weather-chain monitor  # Press Ctrl+C to exit
  ```

---

## Monitoring & Maintenance

### Real-Time Monitoring

```bash
# View live statistics
weather-chain monitor

# Check current status
weather-chain status

# View detailed statistics
weather-chain stats
```

### Prometheus Metrics (Optional)

Enable in `.env`:
```bash
ENABLE_METRICS=true
METRICS_PORT=9090
```

Available metrics:
- `weather_chain_observations_total` - Total observations received
- `weather_chain_transactions_total` - Total blockchain transactions
- `weather_chain_funding_outputs` - Current funding output count
- `weather_chain_errors_total` - Error count by type
- `weather_chain_uptime_seconds` - Service uptime
- `weather_chain_ws_connected` - WebSocket connection status

### Regular Maintenance Tasks

#### Daily

```bash
# Check service status
weather-chain status

# Review statistics
weather-chain stats

# Check funding basket
weather-chain funding status
```

#### Weekly

```bash
# Review error logs
tail -100 weather-chain.log | grep ERROR

# Check for funding basket depletion
weather-chain funding balance

# Review queue backlog
weather-chain queue stats
```

#### Monthly

```bash
# Rotate private key (optional, for security)
# Generate new key, update .env, restart service

# Review and clean old logs
find . -name "*.log" -mtime +30 -delete

# Check MongoDB storage
mongosh --eval "db.stats()"
```

### Health Check Endpoint

```bash
# Check service health
curl http://localhost:3000/health

# Check streaming status
curl http://localhost:3000/api/streaming/status
```

### Log Management

```bash
# View recent logs
tail -50 weather-chain.log

# Search for errors
grep -i error weather-chain.log

# Follow logs in real-time
tail -f weather-chain.log
```

---

## Troubleshooting

### Common Issues

#### 1. WebSocket Not Connecting

**Symptoms:**
- Status shows "Polling" instead of "WebSocket"
- Frequent disconnections

**Solutions:**
```bash
# Check API token
weather-chain config get TEMPEST_API_KEY

# Verify network access
curl -I https://ws.weatherflow.com

# Check firewall rules
# Ensure outbound port 443 is open

# Switch to polling mode for testing
weather-chain stream polling

# Check logs
tail -f weather-chain.log | grep -i websocket
```

#### 2. MongoDB Connection Failed

**Symptoms:**
- "MongoDB: Disconnected" in status
- Connection timeout errors

**Solutions:**
```bash
# Verify MongoDB is running
mongosh --eval "db.version()"

# Check connection string
weather-chain config get MONGO_URI

# Test connection
mongosh "mongodb://localhost:27017/weather-chain"

# For cloud MongoDB, check IP whitelist
# Verify network access from server
curl -v mongodb+srv://<your-connection-string>
```

#### 3. Funding Basket Empty

**Symptoms:**
- "Insufficient funds" errors
- Transactions not being created

**Solutions:**
```bash
# Check wallet balance
weather-chain funding balance

# Refill funding basket
weather-chain funding refill

# Check minimum threshold
weather-chain funding status
```

#### 4. High Error Rate

**Symptoms:**
- Many failed transactions
- Error count increasing

**Solutions:**
```bash
# View error statistics
weather-chain stats | grep -i error

# Check detailed logs
tail -100 weather-chain.log | grep ERROR

# Common causes:
# - Network instability
# - API rate limiting
# - Invalid private key
# - Insufficient funds
```

#### 5. Private Key Issues

**Symptoms:**
- "Invalid private key" errors
- Transactions not signing

**Solutions:**
```bash
# Verify key format (hex, 64 characters)
weather-chain config get SERVER_PRIVATE_KEY | wc -c

# Key should be 64 hex characters (32 bytes = 64 hex chars)

# Regenerate if needed
openssl rand -hex 32

# Update .env and restart service
```

#### 6. Memory Issues

**Symptoms:**
- Service crashes with "Out of Memory"
- Slow performance

**Solutions:**
```bash
# Check memory usage
ps aux | grep node

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Monitor with htop or Activity Monitor
```

### Emergency Procedures

#### Stop the Service

```bash
# If running with npm
Ctrl+C

# If running with PM2
pm2 stop weather-chain

# If running with systemd
sudo systemctl stop weather-chain
```

#### Reset Queue

```bash
# Clear failed transactions (with confirmation)
weather-chain queue clear

# Reset all queue items to pending
weather-chain queue reset
```

#### Reset Funding Basket

```bash
# Clear and recreate funding basket
# Edit .env to change FUNDING_BASKET_MIN if needed
npm run setup
```

#### Restore from Backup

```bash
# Restore MongoDB backup
mongorestore --uri="mongodb://localhost:27017/weather-chain" backup/
```

---

## Security Best Practices

### Environment Variables

```bash
# Never commit .env to version control
echo ".env" >> .gitignore

# Use secrets management in production
# AWS Secrets Manager, HashiCorp Vault, etc.
```

### Private Key Storage

```bash
# Option 1: Environment variable
export SERVER_PRIVATE_KEY=$(cat /path/to/secure/key.txt)

# Option 2: Hardware Security Module (HSM)
# For enterprise deployments

# Option 3: Encrypted key file
# Use GPG or similar encryption
```

### Network Security

```bash
# Firewall rules (ufw example)
sudo ufw allow ssh
sudo ufw allow 3000  # Only if exposing API
sudo ufw enable

# For production, use a reverse proxy (nginx/Apache)
# with HTTPS termination
```

### Access Control

```bash
# Create dedicated system user
sudo useradd -r -s /bin/false weather-chain

# Set correct permissions
chown -R weather-chain:weather-chain /path/to/weather-chain
chmod 600 .env
```

---

## Rollback Procedures

### If Something Goes Wrong

1. **Stop the service** immediately
2. **Check logs** for error details
3. **Revert configuration** changes if recent
4. **Restore from backup** if needed

```bash
# Stop service
pm2 stop weather-chain

# Restore previous version
git checkout <previous-commit>
npm install
npm run build
npm run setup
pm2 restart weather-chain
```

---

## Support & Resources

### Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Getting started guide
- [WEBSOCKET.md](./WEBSOCKET.md) - WebSocket integration details
- [CHANGES.md](./CHANGES.md) - Changelog and migration guide
- [SKILL.md](../.openclaw/workspace/skills/weather-chain/SKILL.md) - OpenClaw CLI reference

### External Resources

- **WeatherFlow API Docs**: https://weatherflow.github.io/Tempest/api/
- **BSV SDK Documentation**: https://docs.bsv.dev
- **MongoDB Atlas**: https://www.mongodb.com/atlas

### Debugging Commands

```bash
# Full diagnostic report
echo "=== Configuration ===" && weather-chain config show
echo "=== Status ===" && weather-chain status
echo "=== Stats ===" && weather-chain stats
echo "=== Funding ===" && weather-chain funding status
echo "=== Queue ===" && weather-chain queue stats
```

---

## Quick Reference

### Essential Commands

```bash
# Start service
npm start

# Check status
weather-chain status

# View stats
weather-chain stats

# Monitor in real-time
weather-chain monitor

# Switch to polling (fallback)
weather-chain stream polling

# Check funding
weather-chain funding status

# Refill funding
weather-chain funding refill
```

### Key Files

| File | Purpose |
|------|---------|
| `.env` | Configuration with credentials |
| `weather-chain.log` | Application logs |
| `dist/` | Compiled JavaScript |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SERVER_PRIVATE_KEY` | Yes | BSV wallet private key |
| `TEMPEST_API_KEY` | Yes | WeatherFlow API token |
| `MONGO_URI` | Yes | MongoDB connection string |
| `BSV_NETWORK` | Yes | 'main' or 'test' |
| `STATION_ID` | Yes | Your Tempest station ID |

---

*Last updated: 2026-01-31*
*Weather Chain Version: 0.1.0*
