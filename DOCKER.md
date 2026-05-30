# Weather Chain - Docker Deployment Guide

This guide explains how to run Weather Chain using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose V2
- Your Tempest API key

## Quick Start

### 1. Configure Environment

Create a `.env` file from the template:

```bash
cp .env.docker .env
```

Edit `.env` and set your `TEMPEST_API_KEY`:

```bash
TEMPEST_API_KEY=your_actual_api_key_here
```

### 2. Build and Start Services

Build the Docker images:

```bash
docker-compose build
```

Start MongoDB:

```bash
docker-compose up -d mongodb
```

Wait for MongoDB to be healthy (about 10 seconds):

```bash
docker-compose ps
```

### 3. Run Setup (First Time Only)

Create the initial funding basket:

```bash
docker-compose --profile setup run --rm setup
```

This will prompt you for how many funding outputs to create (default: 1000).

### 4. Start the Application

Start the Weather Chain service:

```bash
docker-compose up -d app
```

### 5. View Logs

Watch the application logs:

```bash
docker-compose logs -f app
```

You should see:
- Wallet initialization
- Funding basket check
- Weather data polling starting
- Transaction processing

## Docker Compose Services

### MongoDB (`mongodb`)

- **Image**: mongo:7.0
- **Port**: 27017
- **Credentials**: admin/password
- **Database**: weather-chain
- **Data**: Persisted in `mongodb_data` volume

### Application (`app`)

- **Build**: From Dockerfile
- **Depends on**: MongoDB (waits for health check)
- **Restart**: Unless stopped
- **Network**: Internal bridge network

### Setup (`setup`)

- **Profile**: setup (manual run only)
- **Purpose**: Create initial funding basket
- **Command**: `node dist/scripts/setup-funding.js`

## Common Commands

### Start Services

```bash
# Start all services
docker-compose up -d

# Start with logs
docker-compose up
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Just the app
docker-compose logs -f app

# Just MongoDB
docker-compose logs -f mongodb

# Last 100 lines
docker-compose logs --tail=100 app
```

### Restart Services

```bash
# Restart app only
docker-compose restart app

# Restart all
docker-compose restart
```

### Access MongoDB

```bash
# Using docker exec
docker exec -it weather-chain-mongodb mongosh -u admin -p password weather-chain

# From host (if port is exposed)
mongosh mongodb://admin:password@localhost:27017/weather-chain
```

### Check Status

```bash
# Service status
docker-compose ps

# Resource usage
docker stats weather-chain-app weather-chain-mongodb
```

## Configuration

All configuration is done via environment variables in `.env`:

### Required

- `TEMPEST_API_KEY` - Your Tempest weather API key

### Optional (with defaults)

- `SERVER_PRIVATE_KEY` - BSV wallet private key (hex)
- `WALLET_STORAGE_URL` - Wallet storage provider URL
- `BSV_NETWORK` - Network (test/main)
- `POLL_RATE` - API polling interval (seconds)
- `FUNDING_OUTPUT_AMOUNT` - Satoshis per funding output
- `FUNDING_BASKET_MIN` - Minimum funding outputs before refill
- `FUNDING_BATCH_SIZE` - Outputs created per refill
- `WEATHER_OUTPUTS_PER_TX` - Weather outputs per transaction

## Data Persistence

### MongoDB Data

MongoDB data is persisted in Docker volumes:

- `mongodb_data` - Database files
- `mongodb_config` - Configuration files

To backup:

```bash
docker-compose exec mongodb mongodump -u admin -p password -d weather-chain -o /tmp/backup
docker cp weather-chain-mongodb:/tmp/backup ./backup
```

To restore:

```bash
docker cp ./backup weather-chain-mongodb:/tmp/backup
docker-compose exec mongodb mongorestore -u admin -p password -d weather-chain /tmp/backup/weather-chain
```

### Wallet Data

Wallet data is stored in the BSV wallet storage provider (remote), not in the container.

## Development

### Build Only

```bash
docker-compose build
```

### Run Tests

Tests are run automatically during the Docker build. To run manually:

```bash
docker-compose run --rm app npm test
```

### Shell Access

```bash
# App container
docker-compose exec app sh

# MongoDB container
docker-compose exec mongodb sh
```

### Development Mode with Hot Reload

For development with hot reload, use local npm instead:

```bash
# Stop Docker services
docker-compose down

# Start only MongoDB
docker-compose up -d mongodb

# Run app locally
npm run dev
```

## Monitoring

### Application Status

Check the logs for status messages:

```bash
docker-compose logs app | grep STATUS
```

Expected output:

```
[STATUS] Queue: 15 pending, 0 processing, 243 completed, 0 failed
```

### Database Queries

Check pending records:

```bash
docker-compose exec mongodb mongosh -u admin -p password weather-chain --eval "db.weatherrecords.countDocuments({status: 'pending'})"
```

Check completed records:

```bash
docker-compose exec mongodb mongosh -u admin -p password weather-chain --eval "db.weatherrecords.find({status: 'completed'}).limit(5)"
```

### Resource Usage

```bash
docker stats weather-chain-app weather-chain-mongodb
```

## Troubleshooting

### MongoDB Connection Failed

**Problem**: App can't connect to MongoDB

**Solution**:
1. Ensure MongoDB is healthy: `docker-compose ps`
2. Check MongoDB logs: `docker-compose logs mongodb`
3. Wait for health check to pass (10-15 seconds)

### Insufficient Funds Error

**Problem**: "Insufficient funds to create funding outputs"

**Solution**:
1. Fund the wallet with BSV
2. Check wallet balance
3. Retry setup: `docker-compose --profile setup run --rm setup`

### TEMPEST_API_KEY Required

**Problem**: "TEMPEST_API_KEY is required"

**Solution**:
1. Add API key to `.env` file
2. Restart: `docker-compose restart app`

### Permission Denied

**Problem**: Container can't write files

**Solution**:
The container runs as non-root user (nodejs:1001). Ensure volumes have correct permissions.

### Container Exits Immediately

**Problem**: Container starts then exits

**Solution**:
1. Check logs: `docker-compose logs app`
2. Verify environment variables
3. Ensure MongoDB is healthy

## Production Deployment

### Security Recommendations

1. **Change MongoDB Credentials**:
   ```yaml
   environment:
     MONGO_INITDB_ROOT_USERNAME: secure_username
     MONGO_INITDB_ROOT_PASSWORD: secure_password
   ```

2. **Use Production Private Key**:
   ```bash
   SERVER_PRIVATE_KEY=your_production_key
   ```

3. **Don't Expose Ports**:
   Remove port mappings for MongoDB unless necessary

4. **Use Secrets**:
   Consider Docker secrets for sensitive data:
   ```bash
   docker secret create tempest_api_key ./tempest_key.txt
   ```

5. **Enable TLS**:
   Configure MongoDB with TLS certificates

### Resource Limits

Add resource limits in docker-compose.yaml:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Health Checks

The MongoDB service includes a health check. Add one for the app:

```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Logging

Use Docker logging drivers:

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Docker Compose Network          │
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │   MongoDB    │    │  Weather     │  │
│  │   Container  │◄───│  Chain App   │  │
│  │              │    │  Container   │  │
│  │  Port: 27017 │    │              │  │
│  └──────────────┘    └──────────────┘  │
│         │                    │          │
│         ▼                    ▼          │
│  ┌──────────────┐    External APIs     │
│  │    Volume    │    - Tempest API     │
│  │  (mongodb)   │    - BSV Network     │
│  └──────────────┘    - Wallet Storage  │
│                                         │
└─────────────────────────────────────────┘
```

## Clean Up

Remove all containers, networks, and volumes:

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Support

For issues specific to Docker deployment:
1. Check logs: `docker-compose logs`
2. Verify configuration: `docker-compose config`
3. Check service health: `docker-compose ps`

For application issues, see README_SERVICE.md
