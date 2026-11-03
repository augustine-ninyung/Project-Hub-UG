// Build step for Vercel: apply database migrations (production deployments
// only), then build the server and client.
import { execSync } from 'node:child_process';

const run = (command, env = process.env) => execSync(command, { stdio: 'inherit', env });

if (process.env.VERCEL_ENV === 'production') {
  // Supabase's transaction pooler (DATABASE_URL) cannot run migrations, so they
  // use the session pooler connection string in DIRECT_URL.
  if (!process.env.DIRECT_URL) {
    console.error('DIRECT_URL is required to run database migrations on production deploys.');
    process.exit(1);
  }
  run('npm run db:deploy -w server', { ...process.env, DATABASE_URL: process.env.DIRECT_URL });
}

run('npm run build -w server');
run('npm run build -w client');
