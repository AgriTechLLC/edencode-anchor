# EdenCode Anchor — Deploy Guide

**EdenCode Anchor** is a hash-only weather-anchoring web service. It ingests
weather observations, stores them as `pending` in Postgres, then a background
batcher SHA-256-hashes each record, builds a **Merkle root** over the batch,
and marks the records `hashed`. The Merkle root is the anchor-ready artifact.

There is **no BSV wallet, no broadcast, and no funding** in this deploy. Each
batch's `bsv_txid` column stays `NULL` — the cryptographic commitment (the
per-record hash + Merkle root) is what gets persisted and served.

## How it works

```
POST /api/ingest  ->  weather_records (status='pending')
                          |
        background hash loop (every BATCH_INTERVAL_SEC)
                          v
   claim pending -> SHA-256 each record (canonical JSON) ->
   build Merkle root -> insert anchor_batches row ->
   mark each record 'hashed' with record_hash + leaf_index
```

- **Hashing:** canonical JSON `{s, t, d}` (sorted keys) → `sha256hex`.
- **Merkle:** odd nodes duplicate the last leaf; a single leaf's root is itself.
- **Verify:** look up any record by its `record_hash` to get its batch +
  Merkle root.

## Endpoints

| Method | Path                  | Description                                              |
| ------ | --------------------- | ------------------------------------------------------- |
| GET    | `/health`             | `{status:'ok', db, mode:'hashonly'}`                    |
| GET    | `/api/stats`          | counts: `pending`, `hashed`, `error`, `batches`         |
| GET    | `/api/records?limit=` | recent weather records                                  |
| GET    | `/api/anchors?limit=` | recent anchor batches (with `merkle_root`)              |
| GET    | `/api/verify/:hash`   | `{verified, record, batch, merkleRoot}`                 |
| POST   | `/api/ingest`         | body `{stationId, observedAt?, data}` → `{id}`          |
| POST   | `/api/batch`          | manually trigger a hash batch → batch result            |
| GET    | `/`                   | branded dashboard (`public/index.html`)                 |

## Configuration (env)

| Variable             | Required | Default     | Notes                                      |
| -------------------- | -------- | ----------- | ------------------------------------------ |
| `DATABASE_URL`       | **yes**  | —           | Neon Postgres, `sslmode=require`           |
| `PORT`               | no       | `10000`     | Render injects this                        |
| `ANCHOR_MODE`        | no       | `hashonly`  | only `hashonly` is supported               |
| `BATCH_INTERVAL_SEC` | no       | `30`        | hash loop cadence (seconds)                |
| `MAX_BATCH`          | no       | `500`       | max records per batch                      |
| `TEMPEST_API_KEY`    | no       | —           | optional weather ingest helper             |
| `POLL_RATE`          | no       | `300`       | optional poller cadence (seconds)          |

Only `DATABASE_URL` is validated at boot; the rest fall back to defaults.

## Database

Schema lives in `migrations/001_init.sql` (idempotent
`CREATE TABLE IF NOT EXISTS`). Tables: `weather_records`, `anchor_batches`.
Migrations run automatically on boot and can also be run standalone:

```bash
npm run migrate   # node dist/db/migrate.js
```

## Local development

```bash
npm install
export DATABASE_URL="postgres://user:pass@host/db?sslmode=require"
npm run dev       # ts-node src/server.ts  (runs migrate + hash loop + server)
```

## Build & run (production)

```bash
npm install
npm run build         # tsc -> dist/
node dist/db/migrate.js
node dist/server.js
```

## Docker

```bash
docker build -t edencode-anchor .
docker run -p 10000:10000 -e DATABASE_URL="...sslmode=require" edencode-anchor
```

## Deploy to Render

This repo ships a `render.yaml` blueprint:

- **type:** web service, **env:** node, **region:** oregon, **plan:** free
- **build:** `npm install && npm run build`
- **start:** `node dist/db/migrate.js && node dist/server.js`
- **health check:** `/health`
- **env vars:** set `DATABASE_URL` (marked `sync:false`, enter in dashboard);
  `ANCHOR_MODE=hashonly` and `NODE_ENV=production` are preset.

Point Render at this repo, supply `DATABASE_URL`, and deploy. The service
migrates the schema, starts the background hash loop, and serves the dashboard.
