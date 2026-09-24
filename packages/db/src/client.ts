import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

// En runtime se conecta por el pooler (DATABASE_URL); las migraciones usan DIRECT_URL.
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta la variable de entorno DATABASE_URL');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Singleton: evita abrir un pool nuevo en cada hot reload durante el desarrollo.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
