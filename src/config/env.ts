import dotenv from 'dotenv';

// Load environment variables from .env if present
dotenv.config();

/**
 * Environment configuration for the EdenCode Anchor hash-only web service.
 *
 * This service ingests weather observations, stores them as 'pending' in
 * Postgres, then batches + SHA-256 hashes each record and builds a Merkle
 * root over the batch. There is NO BSV wallet, broadcast, or funding —
 * the Merkle root is the anchor-ready artifact (bsv_txid stays NULL).
 */
export const config = {
  // Neon Postgres connection string (sslmode=require). Required.
  DATABASE_URL: process.env.DATABASE_URL ?? '',

  // HTTP server port (Render injects PORT; default 10000).
  PORT: parseInt(process.env.PORT ?? '10000', 10),

  // Anchoring mode. Only 'hashonly' is supported in this deploy.
  ANCHOR_MODE: process.env.ANCHOR_MODE ?? 'hashonly',

  // Optional Tempest API key (used by the optional tempest ingest helper).
  TEMPEST_API_KEY:
    (process.env.TEMPEST_API_KEY?.length ?? 0) > 0
      ? process.env.TEMPEST_API_KEY
      : undefined,

  // Polling cadence in seconds for any external weather poller.
  POLL_RATE: parseInt(process.env.POLL_RATE ?? '300', 10),

  // How often (seconds) the background hash loop runs.
  BATCH_INTERVAL_SEC: parseInt(process.env.BATCH_INTERVAL_SEC ?? '30', 10),

  // Max records claimed per hash batch.
  MAX_BATCH: parseInt(process.env.MAX_BATCH ?? '500', 10),
};

/**
 * Validate required environment variables.
 *
 * Per the interface contract this throws ONLY if DATABASE_URL is missing,
 * so the service can still boot in degraded/dev environments otherwise.
 */
export function validateConfig(): void {
  if (!config.DATABASE_URL) {
    throw new Error(
      'Configuration validation failed: DATABASE_URL is required (Neon Postgres connection string with sslmode=require)'
    );
  }
}
