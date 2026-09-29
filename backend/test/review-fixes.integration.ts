import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DatabaseService } from '../src/database/database.service.js';
import { ProjectService } from '../src/modules/projects/services/project.service.js';
import { ProjectRepository } from '../src/modules/projects/repositories/project.repository.js';
import { ReportRepository } from '../src/modules/reports/repositories/report.repository.js';
import { ReportExportProcessor } from '../src/modules/reports/services/report-export.processor.js';
import { DashboardRepository } from '../src/modules/dashboard/repositories/dashboard.repository.js';
import { StatisticsRepository } from '../src/modules/statistics/repositories/statistics.repository.js';
import { JobsRepository } from '../src/modules/jobs/repositories/jobs.repository.js';
import { ImportRepository } from '../src/modules/catalog-import/repositories/import.repository.js';
import { VisibilityRepository } from '../src/modules/auth/repositories/visibility.repository.js';
import { UserRepository } from '../src/modules/auth/repositories/user.repository.js';
import type { AuthUser } from '../src/modules/auth/index.js';

test('visibility, pagination, comment deletion and JSON export share the same protected data scope', async () => {
  const db = new DatabaseService(),
    suffix = randomUUID();
  const user = await db.prisma.user.create({
    data: { keycloakSubject: suffix },
  });
  const actor: AuthUser = { id: user.id, subject: suffix, level: 10 };
  const direction = await db.prisma.direction.create({
    data: { name: suffix },
  });
  const program = await db.prisma.program.create({ data: { name: suffix } });
  const universities = await Promise.all(
    [0, 1].map((i) =>
      db.prisma.university.create({
        data: {
          name: suffix + i,
          createdById: user.id,
          assignments: { create: { userId: user.id } },
        },
      }),
    ),
  );
  const repo = new ProjectRepository(db),
    reports = new ReportRepository(db),
    jobs = new JobsRepository(db);
  const projects = await Promise.all(
    universities.map((u) =>
      repo.create(
        {
          universityId: u.id,
          directionId: direction.id,
          programId: program.id,
          responsibleId: user.id,
          createdById: user.id,
        },
        ['First', 'Second'],
        user.id,
      ),
    ),
  );
  try {
    const visibility = new VisibilityRepository(db),
      users = new UserRepository(db);
    await visibility.set(user.id, {
      mode: 'SELECTED',
      universityIds: [universities[0].id],
      projectIds: [],
    });
    await assert.rejects(
      visibility.set(user.id, {
        mode: 'SELECTED',
        universityIds: [randomUUID()],
        projectIds: [],
      }),
    );
    assert.deepEqual((await users.visibility(user.id)).universityIds, [
      universities[0].id,
    ]);
    const selected: AuthUser = {
      ...actor,
      visibility: await users.visibility(user.id),
    };
    const page = await repo.list(selected, { page: 1, pageSize: 1 });
    assert.equal(page.total, 1);
    assert.equal(page.rows[0].id, projects[0].id);
    assert.equal('stages' in page.rows[0], false);
    assert.equal('files' in page.rows[0], false);
    assert.equal(
      (await repo.list(actor, { page: 2, pageSize: 1 })).rows.length,
      1,
    );
    assert.equal(await repo.findVisible(selected, projects[1].id), null);
    assert.equal(
      (await reports.list(selected, { page: 1, pageSize: 25 })).total,
      1,
    );
    assert.equal(
      (await new DashboardRepository(db).counts(selected)).activeProjects,
      1,
    );
    assert.equal(
      (await new StatisticsRepository(db).get(selected, {})).data.status.active,
      1,
    );
    const denied = {
      ...actor,
      visibility: {
        mode: 'SELECTED' as const,
        universityIds: [],
        projectIds: [],
      },
    };
    assert.equal(
      (await new DashboardRepository(db).counts(denied)).activeProjects,
      0,
    );
    assert.ok(await repo.findVisible({ ...denied, level: 20 }, projects[1].id));
    const all = {
      ...denied,
      visibility: { ...denied.visibility, mode: 'ALL' as const },
    };
    assert.ok(
      (await new DashboardRepository(db).counts(all)).activeProjects >= 2,
    );
    const service = new ProjectService(repo, {}, {}, {});
    await service.update(actor, projects[0].id, {
      licenseSignedAt: '2026-09-29',
    });
    await service.update(actor, projects[0].id, {
      licenseSignedAt: '2026-09-29T00:00:00.000Z',
    });
    assert.equal(
      (await repo.listEvents(projects[0].id)).filter(
        (e) => e.type === 'LICENSE_SIGNED',
      ).length,
      1,
    );
    await service.update(actor, projects[0].id, {
      licenseSignedAt: null,
      vendor: null,
      contractNumber: null,
      licenseExpiresYear: null,
    });
    assert.equal((await repo.find(projects[0].id))?.licenseSignedAt, null);
    const comment = await repo.createComment(
      projects[0].id,
      undefined,
      user.id,
      'Secret comment',
    );
    await Promise.allSettled([
      repo.updateComment(projects[0].id, comment.id, actor, 'Concurrent edit'),
      repo.deleteComment(projects[0].id, comment.id, actor),
    ]);
    const stored = await db.prisma.projectComment.findUniqueOrThrow({
      where: { id: comment.id },
    });
    assert.ok(stored.deletedAt);
    assert.equal(stored.body, '');
    assert.equal((await repo.listComments(projects[0].id))[0].body, null);
    await assert.rejects(
      repo.updateComment(projects[0].id, comment.id, actor, 'Resurrection'),
    );
    const job = await jobs.createExport(user.id, {
      kind: 'SUMMARY',
      format: 'json',
      permission: 'reports.export',
      parameters: { columns: ['university', 'id'] },
    });
    const processor = new ReportExportProcessor(reports, {
      table: async () => {
        throw new Error('JSON must not invoke browser');
      },
    });
    const artifact = await processor.run(job, selected);
    const document = JSON.parse(artifact.bytes.toString('utf8'));
    assert.deepEqual(document.sections[0].columns, ['Вуз', 'ID']);
    assert.deepEqual(document.sections[0].rows, [
      [universities[0].name, projects[0].id],
    ]);
    const lease = await jobs.claim('export', job.id);
    assert.ok(lease);
    assert.equal(
      await jobs.completeExport(job.id, lease, {
        key: 'test',
        fileName: 'test.json',
        mimeType: artifact.mimeType,
        size: artifact.bytes.length,
        projectIds: artifact.projectIds,
      }),
      true,
    );
    assert.equal(await jobs.inaccessibleCount(job.id, denied), 1);
    assert.equal(await jobs.inaccessibleCount(job.id, all), 0);
  } finally {
    await db.prisma.exportJob.deleteMany({ where: { ownerId: user.id } });
    await db.prisma.project.deleteMany({
      where: { id: { in: projects.map((p) => p.id) } },
    });
    await db.prisma.university.deleteMany({
      where: { id: { in: universities.map((u) => u.id) } },
    });
    await db.prisma.direction.delete({ where: { id: direction.id } });
    await db.prisma.program.delete({ where: { id: program.id } });
    await db.prisma.user.delete({ where: { id: user.id } });
    await db.onModuleDestroy();
  }
});

test('expired import executions cannot mark rows or renew leases and parallel export admission is bounded', async () => {
  const db = new DatabaseService(),
    owner = await db.prisma.user.create({
      data: { keycloakSubject: randomUUID() },
    });
  const repo = new ImportRepository(db),
    jobs = new JobsRepository(db);
  try {
    const job = await repo.create(owner.id, 'test.xlsx', 'test', 'checksum');
    const lease = await jobs.claim('import', job.id);
    assert.ok(lease);
    const row = await db.prisma.importRow.create({
      data: {
        jobId: job.id,
        sheet: 'Вузы',
        rowNumber: 2,
        key: 'test',
        data: { name: 'test' },
        action: 'CREATE',
      },
    });
    await db.prisma.importJob.update({
      where: { id: job.id },
      data: { leaseUntil: new Date(0) },
    });
    const errors = [
      { column: 'Название вуза', code: 'SCOPE', message: 'Unavailable' },
    ];
    await assert.rejects(repo.rowError(job.id, lease, row.id, errors));
    assert.equal((await jobs.heartbeat('import', job.id, lease)).count, 0);
    const replacement = await jobs.claim('import', job.id);
    assert.ok(replacement);
    await assert.rejects(repo.rowError(job.id, lease, row.id, errors));
    assert.equal(
      (await db.prisma.importRow.findUniqueOrThrow({ where: { id: row.id } }))
        .processedAt,
      null,
    );
    assert.equal(
      (await repo.rowError(job.id, replacement, row.id, errors)).count,
      1,
    );
    assert.equal(
      (await repo.rowError(job.id, replacement, row.id, errors)).count,
      0,
    );
    const admitted = await Promise.allSettled(
      Array.from({ length: 11 }, () =>
        jobs.createExport(owner.id, {
          kind: 'SUMMARY',
          format: 'xlsx',
          permission: 'reports.export',
          parameters: {},
        }),
      ),
    );
    assert.equal(admitted.filter((r) => r.status === 'fulfilled').length, 10);
    const rejection = admitted.find((r) => r.status === 'rejected');
    assert.ok(rejection && rejection.status === 'rejected');
    assert.equal(rejection.reason.getStatus(), 429);
  } finally {
    await db.prisma.exportJob.deleteMany({ where: { ownerId: owner.id } });
    await db.prisma.importJob.deleteMany({ where: { ownerId: owner.id } });
    await db.prisma.user.delete({ where: { id: owner.id } });
    await db.onModuleDestroy();
  }
});
