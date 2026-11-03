import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/config/prisma.js';

const TABLES = [
  'Report',
  'Notification',
  'Comment',
  'Like',
  'ProjectContributor',
  'ProjectImage',
  'ProjectTechnology',
  'Project',
  'Technology',
  'Category',
  'AuthToken',
  'UserSession',
  'User',
];

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
