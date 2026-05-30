import { pool } from './pg';

/**
 * A pending weather record claimed for hashing.
 */
export interface PendingRecord {
  id: number;
  station_id: number;
  observed_at: string;
  data: any;
}

/**
 * Aggregate counts used by the dashboard.
 */
export interface Stats {
  pending: number;
  hashed: number;
  error: number;
  batches: number;
}

/**
 * Insert a new weather observation in 'pending' status.
 */
export async function insertPending(
  stationId: number,
  observedAt: Date,
  data: unknown
): Promise<{ id: number }> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO weather_records (station_id, observed_at, data, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id`,
    [stationId, observedAt, JSON.stringify(data)]
  );
  return { id: Number(result.rows[0].id) };
}

/**
 * Claim up to `limit` oldest pending records for hashing.
 *
 * Uses FOR UPDATE SKIP LOCKED so concurrent batchers never grab the same
 * rows. Within this call the rows remain 'pending'; the caller marks each
 * 'hashed' via markHashed() once the batch is built.
 */
export async function claimPending(limit: number): Promise<PendingRecord[]> {
  const result = await pool.query(
    `SELECT id, station_id, observed_at, data
       FROM weather_records
      WHERE status = 'pending'
      ORDER BY id ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED`,
    [limit]
  );
  return result.rows.map((r: any) => ({
    id: Number(r.id),
    station_id: Number(r.station_id),
    observed_at:
      r.observed_at instanceof Date
        ? r.observed_at.toISOString()
        : r.observed_at,
    data: r.data,
  }));
}

/**
 * Insert a new anchor batch row (hash-only; bsv_txid stays NULL).
 */
export async function insertBatch(
  merkleRoot: string,
  leafCount: number
): Promise<{ id: number }> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO anchor_batches (merkle_root, leaf_count, algo, anchor_mode)
     VALUES ($1, $2, 'sha256', 'hashonly')
     RETURNING id`,
    [merkleRoot, leafCount]
  );
  return { id: Number(result.rows[0].id) };
}

/**
 * Mark a record as hashed, attaching its hash, batch and leaf index.
 */
export async function markHashed(
  id: number,
  recordHash: string,
  batchId: number,
  leafIndex: number
): Promise<void> {
  await pool.query(
    `UPDATE weather_records
        SET status = 'hashed',
            record_hash = $2,
            batch_id = $3,
            leaf_index = $4,
            error = NULL,
            hashed_at = now()
      WHERE id = $1`,
    [id, recordHash, batchId, leafIndex]
  );
}

/**
 * Return aggregate counts for the dashboard.
 */
export async function getStats(): Promise<Stats> {
  const result = await pool.query<{
    pending: string;
    hashed: string;
    error: string;
    batches: string;
  }>(
    `SELECT
       (SELECT count(*) FROM weather_records WHERE status = 'pending') AS pending,
       (SELECT count(*) FROM weather_records WHERE status = 'hashed')  AS hashed,
       (SELECT count(*) FROM weather_records WHERE status = 'error')   AS error,
       (SELECT count(*) FROM anchor_batches)                           AS batches`
  );
  const row = result.rows[0];
  return {
    pending: Number(row.pending),
    hashed: Number(row.hashed),
    error: Number(row.error),
    batches: Number(row.batches),
  };
}

/**
 * Most recent weather records (newest first).
 */
export async function listRecords(limit: number): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, station_id, observed_at, status, record_hash,
            batch_id, leaf_index, error, created_at, hashed_at
       FROM weather_records
      ORDER BY id DESC
      LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Most recent anchor batches (newest first).
 */
export async function listBatches(limit: number): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, merkle_root, leaf_count, algo, anchor_mode, bsv_txid, created_at
       FROM anchor_batches
      ORDER BY id DESC
      LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Look up a record by its per-record SHA-256 hash, plus its batch (if any).
 */
export async function findByHash(
  hash: string
): Promise<{ record: any | null; batch: any | null }> {
  const recordResult = await pool.query(
    `SELECT id, station_id, observed_at, data, status, record_hash,
            batch_id, leaf_index, error, created_at, hashed_at
       FROM weather_records
      WHERE record_hash = $1
      ORDER BY id DESC
      LIMIT 1`,
    [hash]
  );

  const record = recordResult.rows[0] ?? null;
  if (!record) {
    return { record: null, batch: null };
  }

  let batch: any | null = null;
  if (record.batch_id !== null && record.batch_id !== undefined) {
    const batchResult = await pool.query(
      `SELECT id, merkle_root, leaf_count, algo, anchor_mode, bsv_txid, created_at
         FROM anchor_batches
        WHERE id = $1`,
      [record.batch_id]
    );
    batch = batchResult.rows[0] ?? null;
  }

  return { record, batch };
}

/**
 * A single anchor batch row.
 */
export interface Batch {
  id: number;
  merkle_root: string;
  leaf_count: number;
  algo: string;
  anchor_mode: string;
  bsv_txid: string | null;
  created_at: string | null;
}

/**
 * A leaf of a batch's Merkle tree, in leaf_index order.
 */
export interface BatchLeaf {
  leafIndex: number;
  hash: string;
  recordId: number;
  stationId: number | null;
  observedAt: string | null;
}

/**
 * Aggregate metrics for the Hash Tree dashboard tab.
 */
export interface Metrics {
  totals: {
    records: number;
    pending: number;
    hashed: number;
    error: number;
    batches: number;
    stations: number;
  };
  batchSize: { avg: number; min: number; max: number };
  treeDepth: { avg: number; min: number; max: number };
  batchSizeHistogram: Array<{ size: number; count: number }>;
  depthHistogram: Array<{ depth: number; count: number }>;
  timeline: Array<{ bucket: string; batches: number; records: number }>;
  latest: { lastRecordAt: string | null; lastBatchAt: string | null };
}

/**
 * Normalize a value that may be a Date or string into an ISO string (or null).
 */
function toIso(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * Merkle tree depth for a batch of `leafCount` leaves.
 *
 * depth = ceil(log2(max(1, leafCount))); 0 when leafCount <= 1.
 */
function treeDepthOf(leafCount: number): number {
  if (leafCount <= 1) {
    return 0;
  }
  return Math.ceil(Math.log2(leafCount));
}

/**
 * Look up a single anchor batch by id (null if not found).
 */
export async function getBatchById(id: number): Promise<Batch | null> {
  const result = await pool.query(
    `SELECT id, merkle_root, leaf_count, algo, anchor_mode, bsv_txid, created_at
       FROM anchor_batches
      WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: Number(row.id),
    merkle_root: row.merkle_root,
    leaf_count: Number(row.leaf_count),
    algo: row.algo,
    anchor_mode: row.anchor_mode,
    bsv_txid: row.bsv_txid ?? null,
    created_at: toIso(row.created_at),
  };
}

/**
 * Return the hashed leaves of a batch ordered by leaf_index (ascending).
 *
 * Only records with a non-null record_hash are returned; the resulting array
 * can be fed directly into buildMerkle() to rebuild the tree.
 */
export async function getBatchLeaves(batchId: number): Promise<BatchLeaf[]> {
  const result = await pool.query(
    `SELECT id, station_id, observed_at, record_hash, leaf_index
       FROM weather_records
      WHERE batch_id = $1
        AND record_hash IS NOT NULL
      ORDER BY leaf_index ASC, id ASC`,
    [batchId]
  );
  return result.rows.map((r: any) => ({
    leafIndex: r.leaf_index === null || r.leaf_index === undefined ? 0 : Number(r.leaf_index),
    hash: r.record_hash,
    recordId: Number(r.id),
    stationId:
      r.station_id === null || r.station_id === undefined
        ? null
        : Number(r.station_id),
    observedAt: toIso(r.observed_at),
  }));
}

/**
 * Aggregate statistics for the Hash Tree metrics view.
 *
 * Computes record/batch totals, batch-size and tree-depth distributions, and a
 * ~14-day daily timeline (UTC) of batches and records. Tree depth is derived in
 * JS from each batch's leaf_count via treeDepthOf().
 */
export async function getMetrics(): Promise<Metrics> {
  const [totalsRes, batchSizeRes, leafCountsRes, batchTimelineRes, recordTimelineRes, latestRes] =
    await Promise.all([
      pool.query(
        `SELECT
           (SELECT count(*) FROM weather_records)                          AS records,
           (SELECT count(*) FROM weather_records WHERE status = 'pending') AS pending,
           (SELECT count(*) FROM weather_records WHERE status = 'hashed')  AS hashed,
           (SELECT count(*) FROM weather_records WHERE status = 'error')   AS error,
           (SELECT count(*) FROM anchor_batches)                           AS batches,
           (SELECT count(DISTINCT station_id) FROM weather_records
              WHERE station_id IS NOT NULL)                                AS stations`
      ),
      pool.query(
        `SELECT
           COALESCE(avg(leaf_count), 0) AS avg,
           COALESCE(min(leaf_count), 0) AS min,
           COALESCE(max(leaf_count), 0) AS max
         FROM anchor_batches`
      ),
      // One row per distinct batch size with how many batches have it.
      pool.query(
        `SELECT leaf_count AS size, count(*) AS count
           FROM anchor_batches
          GROUP BY leaf_count
          ORDER BY leaf_count ASC`
      ),
      // Daily batch counts for the last ~14 days (UTC).
      pool.query(
        `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS bucket,
                count(*) AS batches
           FROM anchor_batches
          WHERE created_at >= (now() AT TIME ZONE 'UTC') - INTERVAL '13 days'
          GROUP BY 1
          ORDER BY 1 ASC`
      ),
      // Daily record counts for the last ~14 days (UTC), by created_at.
      pool.query(
        `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS bucket,
                count(*) AS records
           FROM weather_records
          WHERE created_at >= (now() AT TIME ZONE 'UTC') - INTERVAL '13 days'
          GROUP BY 1
          ORDER BY 1 ASC`
      ),
      pool.query(
        `SELECT
           (SELECT max(created_at) FROM weather_records) AS last_record_at,
           (SELECT max(created_at) FROM anchor_batches)  AS last_batch_at`
      ),
    ]);

  const t = totalsRes.rows[0];
  const bs = batchSizeRes.rows[0];

  // Batch-size histogram + tree-depth histogram (depth derived per batch).
  const batchSizeHistogram = leafCountsRes.rows.map((r: any) => ({
    size: Number(r.size),
    count: Number(r.count),
  }));

  const depthCounts = new Map<number, number>();
  let depthMin = Infinity;
  let depthMax = 0;
  let depthWeightedSum = 0;
  let depthTotal = 0;
  for (const r of leafCountsRes.rows as any[]) {
    const size = Number(r.size);
    const count = Number(r.count);
    const depth = treeDepthOf(size);
    depthCounts.set(depth, (depthCounts.get(depth) ?? 0) + count);
    depthWeightedSum += depth * count;
    depthTotal += count;
    if (depth < depthMin) depthMin = depth;
    if (depth > depthMax) depthMax = depth;
  }
  const depthHistogram = Array.from(depthCounts.entries())
    .map(([depth, count]) => ({ depth, count }))
    .sort((a, b) => a.depth - b.depth);

  // Merge the two daily timelines on bucket.
  const timelineMap = new Map<string, { bucket: string; batches: number; records: number }>();
  for (const r of batchTimelineRes.rows as any[]) {
    const bucket = String(r.bucket);
    const entry = timelineMap.get(bucket) ?? { bucket, batches: 0, records: 0 };
    entry.batches = Number(r.batches);
    timelineMap.set(bucket, entry);
  }
  for (const r of recordTimelineRes.rows as any[]) {
    const bucket = String(r.bucket);
    const entry = timelineMap.get(bucket) ?? { bucket, batches: 0, records: 0 };
    entry.records = Number(r.records);
    timelineMap.set(bucket, entry);
  }
  const timeline = Array.from(timelineMap.values()).sort((a, b) =>
    a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0
  );

  const latest = latestRes.rows[0];

  return {
    totals: {
      records: Number(t.records),
      pending: Number(t.pending),
      hashed: Number(t.hashed),
      error: Number(t.error),
      batches: Number(t.batches),
      stations: Number(t.stations),
    },
    batchSize: {
      avg: Number(bs.avg),
      min: Number(bs.min),
      max: Number(bs.max),
    },
    treeDepth: {
      avg: depthTotal > 0 ? depthWeightedSum / depthTotal : 0,
      min: depthTotal > 0 && depthMin !== Infinity ? depthMin : 0,
      max: depthMax,
    },
    batchSizeHistogram,
    depthHistogram,
    timeline,
    latest: {
      lastRecordAt: toIso(latest.last_record_at),
      lastBatchAt: toIso(latest.last_batch_at),
    },
  };
}

/**
 * Lightweight connectivity probe for the /health endpoint.
 */
export async function dbHealthy(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
