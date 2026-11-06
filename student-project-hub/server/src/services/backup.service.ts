import { createClient } from '@supabase/supabase-js';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

/**
 * Daily backups of the community's data, kept for RETENTION_DAYS.
 *
 * Production stores them in a PRIVATE Supabase bucket ("<SUPABASE_BUCKET>-backups"),
 * which only the dashboard and the service key can read. Without Supabase
 * (development, tests) they go to a local folder.
 *
 * Sessions, one-time tokens and rate-limit counters are left out: they expire
 * anyway, and restoring them would only revive old logins.
 */
export const RETENTION_DAYS = 30;
export const BACKUP_VERSION = 1;
const LOCAL_DIR = path.resolve(process.cwd(), env.BACKUP_LOCAL_DIR);
const NAME_RE = /^backup-(\d{4}-\d{2}-\d{2})\.json\.gz$/;

/** Tables in restore order: everything a row points to comes before it. */
const TABLES = [
  'category',
  'technology',
  'user',
  'project',
  'projectTechnology',
  'projectImage',
  'projectContributor',
  'like',
  'comment',
  'notification',
  'report',
] as const;
type Table = (typeof TABLES)[number];

export interface BackupFile {
  version: number;
  createdAt: string;
  schema: string;
  counts: Record<Table, number>;
  data: Record<Table, Record<string, unknown>[]>;
}

// Prisma delegates share findMany/createMany/count, but their types differ per
// model; this narrow view is all the backup needs.
interface Delegate {
  findMany(args?: unknown): Promise<Record<string, unknown>[]>;
  createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }>;
  count(): Promise<number>;
}
const table = (name: Table) => (prisma as unknown as Record<Table, Delegate>)[name];

/** Older rows first, so replies follow the comments they answer. */
const ORDERED = new Set<Table>(['user', 'project', 'comment', 'notification', 'report', 'like', 'projectContributor']);

export async function exportData(): Promise<BackupFile> {
  const data = {} as BackupFile['data'];
  const counts = {} as BackupFile['counts'];
  for (const name of TABLES) {
    data[name] = await table(name).findMany(ORDERED.has(name) ? { orderBy: { createdAt: 'asc' } } : undefined);
    counts[name] = data[name].length;
  }
  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    schema: env.DATABASE_SCHEMA ?? 'public',
    counts,
    data,
  };
}

// ── Where backups live ───────────────────────────────────────────────

interface BackupStore {
  put(name: string, body: Buffer): Promise<void>;
  list(): Promise<string[]>;
  get(name: string): Promise<Buffer>;
  remove(names: string[]): Promise<void>;
}

function supabaseStore(): BackupStore {
  const bucket = `${env.SUPABASE_BUCKET}-backups`;
  const client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  let ready: Promise<void> | null = null;
  const ensureBucket = () =>
    (ready ??= (async () => {
      const { data } = await client.storage.getBucket(bucket);
      if (data) {
        if (data.public) throw new Error(`Backup bucket "${bucket}" is public; make it private first.`);
        return;
      }
      const { error } = await client.storage.createBucket(bucket, { public: false });
      if (error && !/already exists/i.test(error.message)) throw new Error(`Could not create "${bucket}": ${error.message}`);
    })());
  return {
    async put(name, body) {
      await ensureBucket();
      const { error } = await client.storage
        .from(bucket)
        .upload(name, body, { contentType: 'application/gzip', upsert: true });
      if (error) throw new Error(`Backup upload failed: ${error.message}`);
    },
    async list() {
      await ensureBucket();
      const { data, error } = await client.storage.from(bucket).list('', { limit: 1000 });
      if (error) throw new Error(`Listing backups failed: ${error.message}`);
      return data.map((f) => f.name);
    },
    async get(name) {
      const { data, error } = await client.storage.from(bucket).download(name);
      if (error) throw new Error(`Downloading ${name} failed: ${error.message}`);
      return Buffer.from(await data.arrayBuffer());
    },
    async remove(names) {
      if (names.length === 0) return;
      const { error } = await client.storage.from(bucket).remove(names);
      if (error) throw new Error(`Removing old backups failed: ${error.message}`);
    },
  };
}

const localStore: BackupStore = {
  async put(name, body) {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, name), body);
  },
  async list() {
    try {
      return await readdir(LOCAL_DIR);
    } catch {
      return [];
    }
  },
  get: (name) => readFile(path.join(LOCAL_DIR, name)),
  async remove(names) {
    await Promise.all(names.map((n) => rm(path.join(LOCAL_DIR, n), { force: true })));
  },
};

export const backupStore = (): BackupStore =>
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? supabaseStore() : localStore;

// ── Daily job ────────────────────────────────────────────────────────

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Writes today's backup (replacing an earlier one from the same day) and
 * deletes backups older than the retention period.
 */
export async function runDailyBackup(now = new Date(), store = backupStore()) {
  const file = await exportData();
  const name = `backup-${dayOf(now)}.json.gz`;
  const body = gzipSync(JSON.stringify(file));
  await store.put(name, body);

  const cutoff = dayOf(new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000));
  const expired = (await store.list()).filter((n) => {
    const m = n.match(NAME_RE);
    return m && m[1]! < cutoff;
  });
  await store.remove(expired);

  return { name, bytes: body.length, counts: file.counts, removed: expired };
}

export function readBackup(gz: Buffer): BackupFile {
  const file = JSON.parse(gunzipSync(gz).toString('utf8')) as BackupFile;
  if (file.version !== BACKUP_VERSION || !file.data) throw new Error('Not a ProjectHub backup file');
  return file;
}

/**
 * Loads a backup into an EMPTY database (for example a new Supabase project
 * after a disaster). Refuses if any table already has rows, so it can never
 * mix with or overwrite live data. The one exception is categories: a freshly
 * migrated database already has the default ones, and the backup's replace them.
 */
export async function restoreBackup(file: BackupFile) {
  for (const name of TABLES) {
    if (name === 'category') continue;
    if ((await table(name).count()) > 0) {
      throw new Error(`The database is not empty (${name} has rows). Restore only into an empty database.`);
    }
  }
  const restored = {} as Record<Table, number>;
  await prisma.$transaction(
    async (tx) => {
      // Nothing uses them yet (every other table is empty), so this is safe.
      await tx.category.deleteMany();
      const txTable = (name: Table) => (tx as unknown as Record<Table, Delegate>)[name];
      for (const name of TABLES) {
        const rows = file.data[name] ?? [];
        // Batches keep each statement a reasonable size.
        let count = 0;
        for (let i = 0; i < rows.length; i += 500) {
          count += (await txTable(name).createMany({ data: rows.slice(i, i + 500) })).count;
        }
        restored[name] = count;
      }
    },
    { timeout: 120_000 },
  );
  return restored;
}
