import { PrismaClient } from '@prisma/client';
import { isProduction } from './env.js';

// Reuse a single client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Query errors are not logged here: expected ones (e.g. unique conflicts) are
// handled by services, and unexpected ones are logged by the error handler.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['warn'] });

if (!isProduction) globalForPrisma.prisma = prisma;
