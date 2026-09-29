import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { DatabaseService } from '../src/database/database.service.js';
import { ImportRepository } from '../src/modules/catalog-import/repositories/import.repository.js';
import { ImportProcessor } from '../src/modules/catalog-import/services/import.processor.js';
import { JobsRepository } from '../src/modules/jobs/index.js';
import { UserRepository } from '../src/modules/auth/repositories/user.repository.js';

test('catalog import rechecks scope, persists row results once and keeps imported names after login', async () => {
  const db = new DatabaseService(),
    suffix = randomUUID();
  const objects = new Map<string, Buffer>();
  const source = 'source-' + suffix;
  const storage = {
    get: async (key: string) => {
      const bytes = objects.get(key);
      if (!bytes) throw new Error('missing');
      return bytes;
    },
    put: async (key: string, bytes: Buffer) => {
      objects.set(key, bytes);
    },
    delete: async (key: string) => {
      objects.delete(key);
    },
  };
  const owner = await db.prisma.user.create({
    data: { keycloakSubject: 'importer-' + suffix },
  });
  const user = {
    id: owner.id,
    subject: owner.keycloakSubject,
    level: 10 as const,
  };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['Название вуза'],
      ['Вуз ' + suffix],
      ['Вуз ' + suffix],
      ['Чужой ' + suffix],
    ]),
    'Вузы',
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ['Email', 'ФИО'],
      ['employee@example.test', 'Импортированное ФИО'],
      ['missing@example.test', 'Нет записи'],
    ]),
    'Сотрудники',
  );
  const bytes = Buffer.from(
    XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }),
  );
  objects.set(source, bytes);
  const repo = new ImportRepository(db),
    jobs = new JobsRepository(db);
  const directory = {
    findEmail: async (email: string) =>
      email.startsWith('missing')
        ? []
        : [{ subject: 'employee-' + suffix, email, name: 'Keycloak name' }],
  };
  const processor = new ImportProcessor(repo, directory, storage);
  const job = await repo.create(
    owner.id,
    'test.xlsx',
    source,
    createHash('sha256').update(bytes).digest('hex'),
  );
  let foreignId: string | undefined;
  try {
    foreignId = (
      await db.prisma.university.create({
        data: { name: 'Чужой ' + suffix, createdById: owner.id },
      })
    ).id;
    const execution = await jobs.claim('import', job.id);
    assert.ok(execution);
    await processor.run(
      await db.prisma.importJob.findUniqueOrThrow({ where: { id: job.id } }),
      execution,
      user,
    );
    assert.equal(
      (await db.prisma.importJob.findUniqueOrThrow({ where: { id: job.id } }))
        .status,
      'PREVIEW',
    );
    await db.prisma.importJob.update({
      where: { id: job.id },
      data: { phase: 'APPLY', status: 'QUEUED', attempts: 0 },
    });
    const apply = await jobs.claim('import', job.id);
    assert.ok(apply);
    const running = await db.prisma.importJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    await processor.run(running, apply, user);
    const finalJob = await db.prisma.importJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    assert.ok(finalJob.resultKey && objects.has(finalJob.resultKey));
    const rows = await db.prisma.importRow.findMany({
      where: { jobId: job.id },
      orderBy: { position: 'asc' },
    });
    assert.deepEqual(
      rows.map((r) => r.result),
      ['CREATED', 'SKIPPED', 'ERROR', 'CREATED', 'ERROR'],
    );
    const university = await db.prisma.university.findUniqueOrThrow({
      where: { normalizedName: ('Вуз ' + suffix).toLowerCase() },
      include: { assignments: true },
    });
    assert.equal(university.assignments[0].userId, owner.id);
    await assert.rejects(
      db.prisma.university.create({
        data: { name: '  ВУЗ   ' + suffix, createdById: owner.id },
      }),
    );
    const users = new UserRepository(db);
    const employeeId = await users.ensure('employee-' + suffix, {
      name: 'Updated Keycloak name',
    });
    assert.equal(await users.name(employeeId), 'Импортированное ФИО');
    await processor.run(running, apply, user);
    assert.equal(
      await db.prisma.university.count({
        where: { normalizedName: ('Вуз ' + suffix).toLowerCase() },
      }),
      1,
    );
  } finally {
    await db.prisma.importJob.delete({ where: { id: job.id } });
    await db.prisma.university.deleteMany({
      where: { OR: [{ name: 'Вуз ' + suffix }, { id: foreignId }] },
    });
    await db.prisma.user.deleteMany({
      where: {
        keycloakSubject: { in: [owner.keycloakSubject, 'employee-' + suffix] },
      },
    });
    await db.onModuleDestroy();
  }
});
