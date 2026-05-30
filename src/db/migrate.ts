import * as fs from 'fs';
import * as path from 'path';
import { pool } from './pg';

/**
 * Run every migrations/*.sql file in lexical order against the pool.
 *
 * Each file is expected to be idempotent (CREATE TABLE IF NOT EXISTS, etc.),
 * so this is safe to run on every boot.
 *
 * @returns the ordered list of migration filenames that were applied.
 */
export async function migrate(): Promise<string[]> {
  const migrationsDir = path.join(process.cwd(), 'migrations');

  let files: string[] = [];
  try {
    files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.toLowerCase().endsWith('.sql'))
      .sort();
  } catch (err) {
    throw new Error(
      `Unable to read migrations directory at ${migrationsDir}: ${
        (err as Error).message
      }`
    );
  }

  const applied: string[] = [];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    applied.push(file);
  }

  return applied;
}

// Runnable as a standalone script: `node dist/db/migrate.js`
if (require.main === module) {
  migrate()
    .then((applied) => {
      console.log(
        `[migrate] applied ${applied.length} migration(s): ${
          applied.join(', ') || '(none)'
        }`
      );
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}
