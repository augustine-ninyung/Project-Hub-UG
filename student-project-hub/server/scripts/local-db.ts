/**
 * Runs a real PostgreSQL server for local development without installing
 * Postgres or Docker (binaries come from the `embedded-postgres` package).
 * Data persists in server/.pgdata. Stop with Ctrl+C.
 *
 * Connection string: postgresql://postgres:postgres@localhost:5433/student_hub
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);
const DATABASE = 'student_hub';
const dataDir = path.resolve(import.meta.dirname, '..', '.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: true,
});

const firstRun = !existsSync(dataDir);
if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase(DATABASE);

console.log(`\nPostgreSQL running on port ${PORT}`);
console.log(`DATABASE_URL="postgresql://postgres:postgres@localhost:${PORT}/${DATABASE}"\n`);

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
