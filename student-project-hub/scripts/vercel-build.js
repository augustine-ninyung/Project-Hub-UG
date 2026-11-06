// Build step for Vercel: apply database migrations, then build the server and
// client. Production migrates the live tables; previews migrate only their own
// schema (DATABASE_SCHEMA, e.g. "preview") and refuse to touch "public".
import { execSync } from 'node:child_process';

const run = (command, env = process.env) => execSync(command, { stdio: 'inherit', env });
const target = process.env.VERCEL_ENV;
const schema = process.env.DATABASE_SCHEMA;

if (target === 'preview' && (!schema || schema === 'public')) {
  console.error('Preview deployments need DATABASE_SCHEMA set to a schema other than "public".');
  process.exit(1);
}

/**
 * Previews keep their images in their own bucket. Create it on the first
 * preview build, copying the live bucket's settings (public access, size and
 * type limits). Uses the service key already in Vercel; nothing is printed.
 */
async function ensurePreviewBucket() {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_BUCKET: bucket } = process.env;
  if (!url || !key || !bucket) {
    console.warn('Supabase storage is not configured for previews; skipping the preview bucket.');
    return;
  }
  const api = (method, path, body) =>
    fetch(`${url}/storage/v1/${path}`, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });

  if ((await api('GET', `bucket/${bucket}`)).ok) return; // already there
  const live = await api('GET', `bucket/${process.env.LIVE_SUPABASE_BUCKET || 'project-hub'}`);
  const settings = live.ok ? await live.json() : { public: true };
  const created = await api('POST', 'bucket', {
    id: bucket,
    name: bucket,
    public: settings.public,
    file_size_limit: settings.file_size_limit ?? null,
    allowed_mime_types: settings.allowed_mime_types ?? null,
  });
  if (!created.ok) {
    console.error(`Could not create the "${bucket}" storage bucket (HTTP ${created.status}).`);
    process.exit(1);
  }
  console.log(`Created the "${bucket}" storage bucket for previews.`);
}

if (target === 'production' || target === 'preview') {
  // Supabase's transaction pooler (DATABASE_URL) cannot run migrations, so they
  // use the session pooler connection string in DIRECT_URL.
  if (!process.env.DIRECT_URL) {
    console.error(`DIRECT_URL is required to run database migrations on ${target} deploys.`);
    process.exit(1);
  }
  if (target === 'preview') {
    console.log(`Migrating the "${schema}" schema (preview).`);
    await ensurePreviewBucket();
  }
  run('npm run db:deploy -w server', { ...process.env, DATABASE_URL: process.env.DIRECT_URL });
}

run('npm run build -w server');
run('npm run build -w client');
