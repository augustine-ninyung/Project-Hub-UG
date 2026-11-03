export const TEST_DB_PORT = 5434;

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  `postgresql://postgres:postgres@localhost:${TEST_DB_PORT}/student_hub_test`;
