import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

// Un único .env en la raíz del monorepo.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // El CLI (migrate, studio) usa la conexión directa, sin pooler.
    // `prisma generate` no se conecta, así que puede correr sin .env (ej. en postinstall).
    url: process.env.DIRECT_URL ?? '',
  },
});
