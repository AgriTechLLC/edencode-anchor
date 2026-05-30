import { sha256hex, buildMerkle } from './merkle';
import { claimPending, insertBatch, markHashed } from '../db/repo';

/**
 * Recursively produce a canonical JSON string with object keys sorted at every
 * level, so logically-equal records always serialize identically (and thus
 * hash identically) regardless of key insertion order.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalStringify(v)).join(',') + ']';
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k]));
  return '{' + parts.join(',') + '}';
}

/**
 * Compute the canonical SHA-256 hash (hex) of a weather record.
 *
 * The record is reduced to a canonical envelope { s, t, d }:
 *   s = station_id
 *   t = observed_at as an ISO-8601 string (UTC)
 *   d = the raw observation payload
 * with all object keys sorted recursively before hashing. This yields a stable,
 * order-independent fingerprint of the record.
 *
 * NOTE: The fixed-schema src/format encoder is intentionally not used here: it
 * requires the full 32-field WeatherData shape and throws on missing fields,
 * whereas ingested `data` is arbitrary. The canonical-JSON form hashes any
 * payload deterministically.
 */
export function canonicalHash(record: {
  station_id: number;
  observed_at: string | Date;
  data: unknown;
}): string {
  const observedAt =
    record.observed_at instanceof Date
      ? record.observed_at.toISOString()
      : new Date(record.observed_at).toISOString();

  const canonical = canonicalStringify({
    s: record.station_id,
    t: observedAt,
    d: record.data,
  });

  return sha256hex(canonical);
}

/**
 * Process one batch of pending records:
 *   1. Claim up to `maxBatch` pending records.
 *   2. Hash each into a Merkle leaf.
 *   3. Build the Merkle root over the batch.
 *   4. Persist the batch (merkle_root + leaf_count).
 *   5. Mark each record hashed with its record_hash, batch_id and leaf_index.
 *
 * Returns the number of records batched, the Merkle root and the batch id.
 * If there is nothing pending, returns a no-op result.
 */
export async function runHashBatch(
  maxBatch: number = 500,
): Promise<{ batched: number; root: string | null; batchId: number | null }> {
  const records = await claimPending(maxBatch);

  if (records.length === 0) {
    return { batched: 0, root: null, batchId: null };
  }

  const leaves = records.map((r) =>
    canonicalHash({
      station_id: r.station_id,
      observed_at: r.observed_at,
      data: r.data,
    }),
  );

  const { root } = buildMerkle(leaves);

  const { id: batchId } = await insertBatch(root, leaves.length);

  for (let i = 0; i < records.length; i++) {
    await markHashed(records[i].id, leaves[i], batchId, i);
  }

  return { batched: records.length, root, batchId };
}

/**
 * Start a recurring loop that calls runHashBatch every `intervalSec` seconds.
 * Errors are caught and logged so a single failing tick never tears down the
 * interval. Returns the timer handle so the caller can clear it.
 */
export function startHashLoop(intervalSec: number): NodeJS.Timeout {
  const timer = setInterval(() => {
    runHashBatch().catch((err) => {
      console.error('[hash-processor] runHashBatch failed:', err);
    });
  }, intervalSec * 1000);

  // Don't keep the event loop alive solely for this timer.
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return timer;
}
