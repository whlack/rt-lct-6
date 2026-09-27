import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const permissions = [
  ['universities.read', 10],
  ['universities.create', 10],
  ['universities.update', 10],
  ['university_contacts.read', 10],
  ['university_contacts.create', 10],
  ['university_contacts.update', 10],
  ['catalogs.read', 10],
  ['catalogs.manage', 20],
  ['catalogs.import', 20],
  ['projects.read', 10],
  ['projects.create', 10],
  ['projects.update', 10],
  ['projects.stage.advance', 10],
  ['projects.comments.create', 10],
  ['projects.comments.update', 10],
  ['projects.comments.delete', 10],
  ['projects.files.manage', 10],
  ['projects.workflow.configure', 20],
  ['projects.close', 20],
  ['universities.assignees.manage', 20],
  ['projects.assignees.manage', 20],
  ['permissions.manage', 30],
  ['visibility.manage', 30],
] as const;

try {
  await prisma.$queryRaw`SELECT 1`;
  // Existing levels may have been edited by an administrator; deploy only adds missing keys.
  await prisma.permission.createMany({
    data: permissions.map(([key, minimumLevel]) => ({ key, minimumLevel })),
    skipDuplicates: true,
  });
  console.info('Database connection verified; permission keys are present.');
} finally {
  await prisma.$disconnect();
}
