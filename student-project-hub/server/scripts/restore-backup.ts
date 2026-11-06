// Restores a ProjectHub backup into an EMPTY database.
//
//   npm run db:restore -w server -- <backup-file.json.gz> --yes
//
// Point DATABASE_URL (in server/.env or the environment) at the database to
// fill, for example a brand-new Supabase project after running
// `npm run db:deploy -w server` there. The script refuses to touch a database
// that already has data, so it can't overwrite the live site by accident.
import { readFile } from 'node:fs/promises';
import { prisma } from '../src/config/prisma.js';
import { readBackup, restoreBackup } from '../src/services/backup.service.js';

const [file, flag] = process.argv.slice(2);
if (!file || flag !== '--yes') {
  console.error('Usage: npm run db:restore -w server -- <backup-file.json.gz> --yes');
  process.exit(1);
}

try {
  const backup = readBackup(await readFile(file));
  console.log(`Backup from ${backup.createdAt} (schema "${backup.schema}"):`);
  for (const [name, n] of Object.entries(backup.counts)) console.log(`  ${name.padEnd(20)} ${n}`);
  const restored = await restoreBackup(backup);
  console.log('\nRestored:');
  for (const [name, n] of Object.entries(restored)) console.log(`  ${name.padEnd(20)} ${n}`);
} catch (err) {
  console.error(`\nRestore stopped: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
