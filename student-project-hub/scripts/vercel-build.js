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

if (target === 'production' || target === 'preview') {
  // Supabase's transaction pooler (DATABASE_URL) cannot run migrations, so they
  // use the session pooler connection string in DIRECT_URL.
  if (!process.env.DIRECT_URL) {
    console.error(`DIRECT_URL is required to run database migrations on ${target} deploys.`);
    process.exit(1);
  }
  if (target === 'preview') console.log(`Migrating the "${schema}" schema (preview).`);
  run('npm run db:deploy -w server', { ...process.env, DATABASE_URL: process.env.DIRECT_URL });
}

run('npm run build -w server');
run('npm run build -w client');
