import path from 'path';
import express, { Request, Response, NextFunction } from 'express';

import { config, validateConfig } from './config/env';
import { migrate } from './db/migrate';
import {
  getStats,
  listRecords,
  listBatches,
  findByHash,
  insertPending,
  dbHealthy,
  getBatchById,
  getBatchLeaves,
  getMetrics,
} from './db/repo';
import { buildMerkle } from './anchor/merkle';
import { runHashBatch, startHashLoop } from './anchor/hash-processor';

const app = express();

app.use(express.json({ limit: '1mb' }));

// Lightweight request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

/**
 * Wrap an async route handler so rejected promises hit the error middleware.
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get(
  '/health',
  asyncHandler(async (_req, res) => {
    let db = false;
    try {
      db = await dbHealthy();
    } catch {
      db = false;
    }
    res.status(200).json({ status: 'ok', db, mode: 'hashonly' });
  })
);

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
app.get(
  '/api/stats',
  asyncHandler(async (_req, res) => {
    const stats = await getStats();
    res.json(stats);
  })
);

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------
app.get(
  '/api/records',
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit, 50, 500);
    const records = await listRecords(limit);
    res.json(records);
  })
);

// ---------------------------------------------------------------------------
// Anchor batches
// ---------------------------------------------------------------------------
app.get(
  '/api/anchors',
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit, 50, 500);
    const batches = await listBatches(limit);
    res.json(batches);
  })
);

// ---------------------------------------------------------------------------
// Merkle tree for a single anchor batch
// ---------------------------------------------------------------------------
app.get(
  '/api/anchors/:id/tree',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'invalid batch id' });
      return;
    }

    const batch = await getBatchById(id);
    if (!batch) {
      res.status(404).json({ error: 'batch not found' });
      return;
    }

    const leaves = await getBatchLeaves(id);
    const leafHashes = leaves.map((l) => l.hash);

    // Rebuild the tree from the leaf hashes (ordered by leaf_index) so the
    // layers and root can be independently verified against the stored root.
    const { root, layers } = buildMerkle(leafHashes);
    const depth = layers.length > 0 ? layers.length - 1 : 0;

    res.json({
      batchId: batch.id,
      merkleRoot: batch.merkle_root,
      leafCount: batch.leaf_count,
      depth,
      algo: batch.algo,
      anchorMode: batch.anchor_mode,
      bsvTxid: batch.bsv_txid,
      createdAt: batch.created_at,
      rootMatches: root === batch.merkle_root,
      layers,
      leaves,
    });
  })
);

// ---------------------------------------------------------------------------
// Aggregate metrics / statistics
// ---------------------------------------------------------------------------
app.get(
  '/api/metrics',
  asyncHandler(async (_req, res) => {
    const metrics = await getMetrics();
    res.json(metrics);
  })
);

// ---------------------------------------------------------------------------
// Verify by hash
// ---------------------------------------------------------------------------
app.get(
  '/api/verify/:hash',
  asyncHandler(async (req, res) => {
    const hash = String(req.params.hash || '').trim();
    if (!hash) {
      res.status(400).json({ verified: false, error: 'hash is required' });
      return;
    }
    const { record, batch } = await findByHash(hash);
    if (record) {
      res.json({
        verified: true,
        record,
        batch,
        merkleRoot: batch ? batch.merkle_root : null,
      });
      return;
    }
    res.json({ verified: false });
  })
);

// ---------------------------------------------------------------------------
// Ingest a pending weather observation
// ---------------------------------------------------------------------------
app.post(
  '/api/ingest',
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as {
      stationId?: unknown;
      observedAt?: unknown;
      data?: unknown;
    };

    const stationId = Number(body.stationId);
    if (!Number.isFinite(stationId)) {
      res.status(400).json({ error: 'stationId (number) is required' });
      return;
    }

    if (body.data === undefined || body.data === null || typeof body.data !== 'object') {
      res.status(400).json({ error: 'data (object) is required' });
      return;
    }

    let observedAt: Date;
    if (body.observedAt !== undefined && body.observedAt !== null) {
      observedAt = new Date(String(body.observedAt));
      if (Number.isNaN(observedAt.getTime())) {
        res.status(400).json({ error: 'observedAt must be a valid ISO timestamp' });
        return;
      }
    } else {
      observedAt = new Date();
    }

    const result = await insertPending(stationId, observedAt, body.data);
    res.status(201).json(result);
  })
);

// ---------------------------------------------------------------------------
// Manual batch trigger
// ---------------------------------------------------------------------------
app.post(
  '/api/batch',
  asyncHandler(async (_req, res) => {
    const result = await runHashBatch(config.MAX_BATCH);
    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// Static dashboard
// ---------------------------------------------------------------------------
const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('Request error:', err);
  res.status(500).json({ error: 'internal_error', message: err.message });
});

/**
 * Parse and clamp a limit query parameter.
 */
function parseLimit(raw: unknown, fallback: number, max: number): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.min(n, max);
}

/**
 * Boot sequence: validate config, run migrations, start the hash loop, listen.
 */
async function main(): Promise<void> {
  validateConfig();

  // Idempotent migrations on boot.
  try {
    await migrate();
    // eslint-disable-next-line no-console
    console.log('Migrations applied.');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err);
    throw err;
  }

  // Background batcher loop.
  startHashLoop(config.BATCH_INTERVAL_SEC);
  // eslint-disable-next-line no-console
  console.log(`Hash loop started (every ${config.BATCH_INTERVAL_SEC}s).`);

  app.listen(config.PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(
      `EdenCode Anchor listening on 0.0.0.0:${config.PORT} (mode=${config.ANCHOR_MODE})`
    );
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});

export { app };
