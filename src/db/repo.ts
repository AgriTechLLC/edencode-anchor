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
