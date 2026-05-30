# Weather Chain - Docker Quick Start

Get Weather Chain running in Docker in 5 minutes.

## Prerequisites

- Docker installed
- Docker Compose V2 installed
- Tempest API key

## Setup (5 Steps)

### 1. Clone & Configure

```bash
cd weather-chain
cp .env.docker .env
```

Edit `.env` and set your `TEMPEST_API_KEY`:

```bash
TEMPEST_API_KEY=your_actual_key_here
```

### 2. Build & Start

Using Makefile (recommended):

```bash
make build
make up
```

Or using docker-compose:

```bash
docker-compose build
docker-compose up -d mongodb
sleep 10  # Wait for MongoDB
docker-compose up -d app
```

### 3. Create Funding Basket

```bash
make setup
```

Or:

```bash
docker-compose --profile setup run --rm setup
```

This creates 1000 hash puzzle funding outputs (one-time setup).

### 4. Verify

Check logs:

```bash
make logs
```

You should see:
```
[INFO] Connected to MongoDB
[INFO] Wallet initialized
[INFO] Starting weather data polling (interval: 300s)
[INFO] Starting record processor (interval: 3s)
```

### 5. Monitor

Check status:

```bash
make status
```

View MongoDB records:

```bash
make mongo-shell
> db.weatherrecords.countDocuments({status: 'completed'})
```

## Common Commands

```bash
# Start everything
make up

# Stop everything
make down

# View logs
make logs

# Restart app
make restart

# Check status
make status

# Open MongoDB shell
make mongo-shell

# Clean up everything (WARNING: deletes data)
make clean
```

## Verify It's Working

### 1. Check Services

```bash
docker-compose ps
```

Expected output:
```
NAME                    STATUS              PORTS
weather-chain-app       Up (healthy)
weather-chain-mongodb   Up (healthy)        27017/tcp
```

### 2. Check Logs

```bash
docker-compose logs app | grep -E "(INFO|STATUS)"
```

Expected output:
```
[INFO] Connected to MongoDB successfully
[INFO] Wallet initialized
[INFO] Starting weather data polling
[STATUS] Queue: 5 pending, 0 processing, 10 completed, 0 failed
```

### 3. Check Database

```bash
docker-compose exec mongodb mongosh -u admin -p password weather-chain --eval "db.weatherrecords.countDocuments({})"
```

Should return number of weather records.

### 4. Check Funding Basket

Look for this in logs:

```bash
docker-compose logs app | grep "funding outputs"
```

Expected:
```
Current funding outputs: 1000
```

## Troubleshooting

### MongoDB Not Ready

**Symptom**: App exits immediately

**Fix**:
```bash
# Wait for MongoDB health check
docker-compose ps
# Wait until STATUS shows "healthy"
```

### Can't Connect to MongoDB

**Symptom**: Connection refused errors

**Fix**:
```bash
# Restart MongoDB
docker-compose restart mongodb
sleep 10
docker-compose restart app
```

### Missing API Key

**Symptom**: "TEMPEST_API_KEY is required"

**Fix**:
```bash
# Edit .env
nano .env
# Add: TEMPEST_API_KEY=your_key
docker-compose restart app
```

### Insufficient Funds

**Symptom**: "Insufficient funds to create funding outputs"

**Fix**:
- Fund your BSV wallet with satoshis
- Retry setup: `make setup`

## Development Mode

Run only MongoDB in Docker, app locally:

```bash
# Start MongoDB only
make dev

# In another terminal
npm run dev
```

This allows faster iteration during development.

## Production Deployment

See DOCKER.md for:
- Security hardening
- Resource limits
- Logging configuration
- Backup procedures
- Monitoring setup

## Next Steps

1. ✅ Services running
2. ✅ Funding basket created
3. ⏭️ Monitor logs for first poll
4. ⏭️ Verify first transaction
5. ⏭️ Set up production monitoring

## Help

- **Docker Guide**: `DOCKER.md`
- **Service Docs**: `README_SERVICE.md`
- **Full Docs**: `QUICKSTART.md`

## Summary

Weather Chain is now running in Docker with:
- ✅ MongoDB integrated
- ✅ Auto-restart enabled
- ✅ Health checks configured
- ✅ Data persistence
- ✅ Easy setup and management

Start: `make up`
Setup: `make setup`
Logs: `make logs`
Stop: `make down`
