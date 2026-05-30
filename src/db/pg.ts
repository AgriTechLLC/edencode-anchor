import { Pool } from 'pg';
import { config } from '../config/env';

/**
 * Shared Postgres connection pool.
 *
 * Targets Neon (sslmode=require). We accept Neon's certificate chain via
 * rejectUnauthorized:false, which is the standard pattern for connecting to
 * Neon/managed Postgres from Node without bundling the CA bundle.
 */
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  // Avoid crashing the process on idle client errors.
  console.error('[pg] unexpected idle client error:', err.message);
});
