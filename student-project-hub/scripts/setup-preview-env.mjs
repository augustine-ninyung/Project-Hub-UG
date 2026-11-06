// One-time setup for Vercel preview deployments. Run it yourself from the
// student-project-hub folder (you must be logged in to the Vercel CLI):
//
//   node scripts/setup-preview-env.mjs
//
// It copies the Production settings to the Preview environment, except that
// previews get:
//   - DATABASE_SCHEMA=preview      their own tables (the live ones are untouched)
//   - SUPABASE_BUCKET=<bucket>-preview  their own image bucket (created here)
//   - a new JWT_ACCESS_SECRET      live sessions don't work on previews
//
// Secrets are read from Vercel into memory and passed straight back to Vercel.
// Nothing secret is printed or kept on disk: the temporary file Vercel writes
// is deleted at once.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const COPY = [
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
  spawnSync('npx', ['--yes', 'vercel@latest', ...args], {
    input,
    shell: true,
    encoding: 'utf8',
  });

// 1. Read Production settings (into a private temp folder, deleted right away).
const dir = mkdtempSync(path.join(tmpdir(), 'ph-env-'));
const file = path.join(dir, 'production.env');
let prod;
try {
  const pulled = vercel(['env', 'pull', `"${file}"`, '--environment=production', '--yes']);
  if (pulled.status !== 0) {
    console.error('Could not read the Production settings from Vercel. Are you logged in (npx vercel login)?');
    process.exit(1);
  }
  prod = Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, key, raw]) => [key, raw.replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n')]),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const missing = COPY.filter((k) => !prod[k]);
if (missing.length) {
  console.error(`These Production settings came back empty, so nothing was changed: ${missing.join(', ')}`);
  console.error('(Variables marked "Sensitive" in Vercel cannot be read back; re-add them as normal secrets first.)');
  process.exit(1);
}

// 2. A separate storage bucket with the same settings as the live one.
const liveBucket = prod.SUPABASE_BUCKET || 'project-hub';
const previewBucket = `${liveBucket}-preview`;
const supabase = (method, url, body) =>
  fetch(`${prod.SUPABASE_URL}/storage/v1/${url}`, {
    method,
    headers: {
      apikey: prod.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${prod.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body && JSON.stringify(body),
  });
const live = await supabase('GET', `bucket/${liveBucket}`);
if (!live.ok) {
  console.error(`Could not read the "${liveBucket}" bucket settings from Supabase (HTTP ${live.status}).`);
  process.exit(1);
}
const settings = await live.json();
const created = await supabase('POST', 'bucket', {
  id: previewBucket,
  name: previewBucket,
  public: settings.public,
  file_size_limit: settings.file_size_limit,
  allowed_mime_types: settings.allowed_mime_types,
});
const createdBody = created.ok ? null : await created.text();
if (created.ok) console.log(`Storage bucket "${previewBucket}" created.`);
else if (/already exists|Duplicate/i.test(createdBody)) console.log(`Storage bucket "${previewBucket}" already exists.`);
else {
  console.error(`Could not create the "${previewBucket}" bucket (HTTP ${created.status}).`);
  process.exit(1);
}

// 3. Write the Preview settings.
const preview = {
  ...Object.fromEntries(COPY.map((k) => [k, prod[k]])),
  DATABASE_SCHEMA: 'preview',
  SUPABASE_BUCKET: previewBucket,
  JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
};
let failed = 0;
for (const [name, value] of Object.entries(preview)) {
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
