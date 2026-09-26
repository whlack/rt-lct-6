import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Generation and compilation do not connect to a database; runtime commands supply DATABASE_URL.
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://unused:unused@localhost:5432/unused',
  },
});
