// One-time setup for Vercel preview deployments. Run it yourself from the
// student-project-hub folder, logged in to the Vercel CLI:
//
//   node scripts/setup-preview-env.mjs
//
// Before running it, share these Production settings with Preview in the
// Vercel dashboard (Settings > Environment Variables > Edit > tick Preview):
// Vercel never hands secret values back, so they can't be copied by a script.
//
// The script then adds the three settings that must differ on previews:
//   DATABASE_SCHEMA=preview          their own tables (the live ones are untouched)
//   SUPABASE_BUCKET=project-hub-preview  their own image bucket (created by the first preview build)
//   JWT_ACCESS_SECRET=<new random>   live sessions don't work on previews
// None of these are read from anywhere, and nothing secret is printed.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

/** Shared with Preview via the dashboard (same values as Production). */
const SHARED = [
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_SECURE',
  'EMAIL_FROM',
];

const vercel = (args, input) =>
  spawnSync('npx', ['--yes', 'vercel@latest', ...args], { input, shell: true, encoding: 'utf8' });

// 1. Check which settings Preview already has (names only).
const listed = vercel(['env', 'ls', 'preview']);
if (listed.status !== 0) {
  console.error('Could not list the Preview settings. Are you logged in (npx vercel login)?');
  process.exit(1);
}
const present = new Set(
  listed.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((name) => /^[A-Z][A-Z0-9_]+$/.test(name)),
);
const missing = SHARED.filter((name) => !present.has(name));
if (missing.length) {
  console.error('These settings are not shared with Preview yet:\n');
  for (const name of missing) console.error(`  - ${name}`);
  console.error(
    '\nIn Vercel: your project > Settings > Environment Variables. For each one, click the "..." > Edit,',
    '\ntick "Preview" next to Production, and Save. Leave JWT_ACCESS_SECRET and SUPABASE_BUCKET as they are.',
    '\nThen run this script again.',
  );
  process.exit(1);
}
console.log('Shared settings are available to previews.');

// 2. Add the preview-only settings.
const previewOnly = {
  DATABASE_SCHEMA: 'preview',
  SUPABASE_BUCKET: 'project-hub-preview',
  JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
};
let failed = 0;
for (const [name, value] of Object.entries(previewOnly)) {
  const res = vercel(['env', 'add', name, '--environment', 'preview', '--force', '--yes'], value);
  const ok = res.status === 0;
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}`);
}
if (failed) {
  console.error(`\n${failed} setting(s) could not be saved. Tell Claude which ones failed.`);
  process.exit(1);
}
console.log('\nPreview environment ready. Go back to Claude and say "done".');
