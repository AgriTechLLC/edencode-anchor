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

  // Tempest station IDs to poll for live observations (comma-separated env,
  // e.g. "196029,196035"). Defaults to an empty list (poller stays disabled).
  TEMPEST_STATION_IDS: (process.env.TEMPEST_STATION_IDS ?? '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n)),

  // Polling cadence in seconds for the live weather poller.
  POLL_RATE: parseInt(process.env.POLL_RATE ?? '60', 10),

  // How often (seconds) the background hash loop runs.
  BATCH_INTERVAL_SEC: parseInt(process.env.BATCH_INTERVAL_SEC ?? '30', 10),

  // Max records claimed per hash batch.
  MAX_BATCH: parseInt(process.env.MAX_BATCH ?? '500', 10),

  // Whether the live poller should run. True only when a Tempest API key is
  // present AND at least one station id is configured. Derived below.
  POLL_ENABLED: false,
};

// Derived: the poller is enabled only with both a key and at least one station.
config.POLL_ENABLED =
  (config.TEMPEST_API_KEY?.length ?? 0) > 0 &&
  config.TEMPEST_STATION_IDS.length > 0;

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
