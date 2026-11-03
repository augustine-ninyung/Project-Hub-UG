import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './tests/test-db.js';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Tests share one database, so files run sequentially.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
    teardownTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-test-secret',
      CLIENT_URL: 'http://localhost:5173',
      CORS_ORIGINS: 'http://localhost:5173',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SMTP_HOST: '',
      LOCAL_UPLOAD_DIR: '.uploads-test',
    },
  },
});
