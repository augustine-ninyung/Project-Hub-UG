/**
 * Provides a throwaway PostgreSQL for the test run. If TEST_DATABASE_URL is
 * set (e.g. in CI), that database is used instead of an embedded instance.
 * Pending migrations are applied before the suite starts.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { execSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { TEST_DB_PORT, testDatabaseUrl } from './test-db.js';

let pg: EmbeddedPostgres | undefined;

export async function setup() {
  const databaseUrl = testDatabaseUrl;

  if (!process.env.TEST_DATABASE_URL) {
    const dataDir = path.resolve(import.meta.dirname, '..', '.pgdata-test');
    await rm(dataDir, { recursive: true, force: true });
    pg = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: 'postgres',
      password: 'postgres',
      port: TEST_DB_PORT,
      persistent: false,
      onLog: () => undefined,
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('student_hub_test');
  }

  // The embedded database is created empty; per-test truncation handles data.
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

export async function teardown() {
  const started = Date.now();
  await pg?.stop();
  if (process.env.DEBUG_TEST_DB) console.log(`test database stopped in ${Date.now() - started}ms`);
  await rm(path.resolve(import.meta.dirname, '..', '.uploads-test'), {
    recursive: true,
    force: true,
  });
}
