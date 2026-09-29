import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DatabaseService } from '../src/database/database.service.js';
import { JobsRepository } from '../src/modules/jobs/index.js';
import { JobsService } from '../src/modules/jobs/services/jobs.service.js';
import { PermissionService } from '../src/modules/permissions/services/permission.service.js';
import { PermissionRepository } from '../src/modules/permissions/repositories/permission.repository.js';

test('leases have one owner, committed exports retain scope and retry is idempotent', async () => {
  const db = new DatabaseService();
  const repo = new JobsRepository(db);
  const suffix = randomUUID();
  const permissionKey = 'test.jobs.' + suffix;
  await db.prisma.permission.create({
    data: { key: permissionKey, minimumLevel: 10 },
  });
  let userId: string | undefined,
    universityId: string | undefined,
    projectId: string | undefined,
    jobId: string | undefined,
    directionId: string | undefined,
    programId: string | undefined;
  try {
    const user = await db.prisma.user.create({
      data: { keycloakSubject: suffix },
    });
    userId = user.id;
    const direction = await db.prisma.direction.create({
      data: { name: suffix },
    });
    directionId = direction.id;
    const program = await db.prisma.program.create({ data: { name: suffix } });
    programId = program.id;
    const university = await db.prisma.university.create({
      data: { name: suffix, createdById: userId },
    });
    universityId = university.id;
    const project = await db.prisma.project.create({
      data: {
        universityId,
        directionId,
        programId,
        responsibleId: userId,
        createdById: userId,
      },
    });
    projectId = project.id;
    const job = await repo.createExport(userId, {
      kind: 'SUMMARY',
      format: 'xlsx',
      permission: permissionKey,
      parameters: {},
    });
    jobId = job.id;
    const leases = await Promise.all([
      repo.claim('export', jobId),
      repo.claim('export', jobId),
    ]);
    assert.equal(leases.filter(Boolean).length, 1);
    const executionId = leases.find((id): id is string => id !== null)!;
    assert.equal(
      await repo.completeExport(jobId, randomUUID(), {
        key: 'wrong',
        fileName: 'x',
        mimeType: 'x',
        size: 1,
        projectIds: [projectId],
      }),
      false,
    );
    assert.equal(
      await repo.completeExport(jobId, executionId, {
        key: 'right',
        fileName: 'x',
        mimeType: 'x',
        size: 1,
        projectIds: [projectId],
      }),
      true,
    );
    assert.equal(await repo.claim('export', jobId), null);
    await repo.fail(
      'export',
      jobId,
      executionId,
      false,
      1,
      'TEMPORARY_FAILURE',
    );
    assert.equal(
      (await db.prisma.exportJob.findUniqueOrThrow({ where: { id: jobId } }))
        .status,
      'SUCCEEDED',
    );
    let reads = 0;
    const actor = { id: userId, subject: suffix, level: 10 as const };
    const service = new JobsService(
      repo,
      { notify: async () => {} },
      new PermissionService(new PermissionRepository(db)),
      {
        get: async () => {
          reads++;
          return Buffer.from('result');
        },
      },
      { resolve: async () => actor },
    );
    assert.equal((await service.file(actor, jobId)).bytes.toString(), 'result');
    assert.equal(reads, 1);
    await db.prisma.permission.update({
      where: { key: permissionKey },
      data: { minimumLevel: 20 },
    });
    await assert.rejects(service.file(actor, jobId));
    assert.equal(reads, 1);
    await db.prisma.permission.update({
      where: { key: permissionKey },
      data: { minimumLevel: 10 },
    });
    const replacement = await db.prisma.user.create({
      data: { keycloakSubject: 'replacement-' + suffix },
    });
    try {
      await db.prisma.project.update({
        where: { id: projectId },
        data: { responsibleId: replacement.id },
      });
      await assert.rejects(service.file(actor, jobId));
      assert.equal(reads, 1);
    } finally {
      await db.prisma.project.update({
        where: { id: projectId },
        data: { responsibleId: userId },
      });
      await db.prisma.user.delete({ where: { id: replacement.id } });
    }
    await assert.rejects(service.get({ ...actor, id: randomUUID() }, jobId));
    await db.prisma.exportJob.update({
      where: { id: jobId },
      data: { expiresAt: new Date(0) },
    });
    await assert.rejects(service.file(actor, jobId));
    assert.equal(reads, 1);
    await db.prisma.exportJob.update({
      where: { id: jobId },
      data: { expiresAt: new Date(Date.now() + 3600000) },
    });
    assert.equal(
      await repo.inaccessibleCount(jobId, {
        id: userId,
        subject: suffix,
        level: 20,
      }),
      0,
    );
    assert.equal(
      await repo.inaccessibleCount(jobId, {
        id: userId,
        subject: suffix,
        level: 10,
      }),
      0,
    );
    assert.equal(
      await repo.inaccessibleCount(jobId, {
        id: randomUUID(),
        subject: suffix,
        level: 10,
      }),
      1,
    );
    const retry = await repo.createExport(userId, {
      kind: 'SUMMARY',
      format: 'xlsx',
      permission: 'reports.export',
      parameters: {},
    });
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const lease = await repo.claim('export', retry.id);
        assert.ok(lease);
        await repo.fail(
          'export',
          retry.id,
          lease,
          false,
          attempt,
          'TEMPORARY_FAILURE',
        );
      }
      assert.equal(
        (
          await db.prisma.exportJob.findUniqueOrThrow({
            where: { id: retry.id },
          })
        ).status,
        'FAILED',
      );
      assert.equal(await repo.claim('export', retry.id), null);
      await db.prisma.exportJob.update({
        where: { id: retry.id },
        data: { status: 'RUNNING', attempts: 3, leaseUntil: new Date(0) },
      });
      await repo.pending();
      assert.equal(
        (
          await db.prisma.exportJob.findUniqueOrThrow({
            where: { id: retry.id },
          })
        ).errorCode,
        'RETRY_EXHAUSTED',
      );
    } finally {
      await db.prisma.exportJob.delete({ where: { id: retry.id } });
    }
  } finally {
    if (jobId) await db.prisma.exportJob.delete({ where: { id: jobId } });
    if (projectId) await db.prisma.project.delete({ where: { id: projectId } });
    if (universityId)
      await db.prisma.university.delete({ where: { id: universityId } });
    if (directionId)
      await db.prisma.direction.delete({ where: { id: directionId } });
    if (programId) await db.prisma.program.delete({ where: { id: programId } });
    if (userId) await db.prisma.user.delete({ where: { id: userId } });
    await db.prisma.permission.delete({ where: { key: permissionKey } });
    await db.onModuleDestroy();
  }
});

test('cleanup expires crashed imports, clears row data, and deletes only unreferenced temporary objects', async () => {
  const { CleanupService } =
    await import('../src/modules/jobs/services/cleanup.service.js');
  const db = new DatabaseService();
  const user = await db.prisma.user.create({
    data: { keycloakSubject: randomUUID() },
  });
  const job = await db.prisma.importJob.create({
    data: {
      ownerId: user.id,
      checksum: 'audit-checksum',
      fileName: 'private.xlsx',
      sourceKey: 'imports/source-test',
      resultKey: 'imports/errors-test',
      status: 'RUNNING',
      leaseUntil: new Date(0),
      expiresAt: new Date(0),
      rows: {
        create: {
          sheet: 'Вузы',
          rowNumber: 2,
          key: 'private',
          data: { name: 'private' },
          action: 'CREATE',
        },
      },
    },
  });
  const live = await db.prisma.importJob.create({
    data: {
      ownerId: user.id,
      checksum: 'live',
      fileName: 'live.xlsx',
      sourceKey: 'imports/live-test',
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  const deleted: string[] = [];
  const cleanup = new CleanupService(db, {
    delete: async (key) => {
      deleted.push(key);
      return {};
    },
    async *oldTemporaryKeys() {
      yield 'imports/orphan-test';
      yield 'imports/live-test';
    },
  });
  try {
    await cleanup.run();
    const expired = await db.prisma.importJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    assert.equal(expired.status, 'EXPIRED');
    assert.equal(expired.sourceKey, null);
    assert.equal(expired.resultKey, null);
    assert.equal(expired.checksum, 'audit-checksum');
    assert.equal(
      await db.prisma.importRow.count({ where: { jobId: job.id } }),
      0,
    );
    assert.deepEqual(deleted.sort(), [
      'imports/errors-test',
      'imports/orphan-test',
      'imports/source-test',
    ]);
    await cleanup.run();
    assert.equal(
      deleted.filter((key) => key === 'imports/source-test').length,
      1,
    );
  } finally {
    await db.prisma.importJob.deleteMany({
      where: { id: { in: [job.id, live.id] } },
    });
    await db.prisma.user.delete({ where: { id: user.id } });
    await db.onModuleDestroy();
  }
});
