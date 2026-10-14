import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: url });
const dir = fileURLToPath(new URL('../migrations/', import.meta.url));

try {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(701236489)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const files = (await readdir(dir)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of files) {
      const exists = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      if (exists.rowCount) continue;
      await client.query('BEGIN');
      try {
        await client.query(await readFile(join(dir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        process.stdout.write(`Applied ${file}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(701236489)');
    client.release();
  }
} finally {
  await pool.end();
}
