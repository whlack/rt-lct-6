import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DatabaseService } from '../src/database/database.service.js';
import { DashboardRepository } from '../src/modules/dashboard/repositories/dashboard.repository.js';
import { ReportRepository } from '../src/modules/reports/repositories/report.repository.js';
import { ReportQueryDto } from '../src/modules/reports/index.js';

test('scoped counters, local date boundaries, deduplication and safe detail reports', async () => {
  const db = new DatabaseService();
  const suffix = randomUUID();
  const users: string[] = [],
    universities: string[] = [],
    projects: string[] = [];
  let directionId: string | undefined, programId: string | undefined;
  try {
    const owner = await db.prisma.user.create({
      data: { keycloakSubject: 'owner-' + suffix },
    });
    users.push(owner.id);
    const foreign = await db.prisma.user.create({
      data: { keycloakSubject: 'foreign-' + suffix },
    });
    users.push(foreign.id);
    const actor = {
      id: owner.id,
      subject: owner.keycloakSubject,
      level: 10 as const,
    };
    const direction = await db.prisma.direction.create({
      data: { name: suffix },
    });
    directionId = direction.id;
    const program = await db.prisma.program.create({ data: { name: suffix } });
    programId = program.id;
    const u1 = await db.prisma.university.create({
      data: {
        name: 'assigned-' + suffix,
        createdById: owner.id,
        assignments: { create: { userId: owner.id } },
      },
    });
    universities.push(u1.id);
    const u2 = await db.prisma.university.create({
      data: { name: 'foreign-' + suffix, createdById: foreign.id },
    });
    universities.push(u2.id);
    for (const [index, data] of [
      { universityId: u1.id, responsibleId: foreign.id, closedAt: null },
      { universityId: u2.id, responsibleId: owner.id, closedAt: null },
      { universityId: u2.id, responsibleId: foreign.id, closedAt: null },
      { universityId: u1.id, responsibleId: foreign.id, closedAt: new Date() },
    ].entries()) {
      const p = await db.prisma.project.create({
        data: {
          ...data,
          directionId,
          programId,
          createdById: owner.id,
          stages: {
            create: {
              position: 0,
              title: 'Stage',
              expectedActor: index === 1 ? 'UNIVERSITY' : 'KAM',
            },
          },
          events: {
            create: [
              {
                actorId: owner.id,
                type: 'PROJECT_CREATED',
                objectType: 'project',
                objectId: owner.id,
                createdAt: new Date('2026-03-31T21:00:00Z'),
              },
              {
                actorId: owner.id,
                type: 'PROJECT_UPDATED',
                objectType: 'project',
                objectId: owner.id,
                createdAt: new Date('2026-04-01T20:59:59Z'),
              },
            ],
          },
        },
      });
      projects.push(p.id);
    }
    const counts = await new DashboardRepository(db).counts(actor);
    assert.equal(counts.universities, 1);
    assert.equal(counts.activeProjects, 2);
    assert.equal(counts.actionRequiredProjects, 1);
    const reports = new ReportRepository(db);
    const query = Object.assign(new ReportQueryDto(), {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-01',
      directionId,
    });
    const result = await reports.list(actor, query);
    assert.equal(result.total, 3);
    assert.equal(new Set(result.rows.map((r) => r.id)).size, 3);
    const outside = await reports.list(
      actor,
      Object.assign(new ReportQueryDto(), {
        dateFrom: '2026-04-02',
        dateTo: '2026-04-02',
        directionId,
      }),
    );
    assert.equal(outside.total, 0);
    await db.prisma.projectComment.create({
      data: {
        projectId: projects[0],
        authorId: owner.id,
        body: 'sensitive deleted text',
        deletedAt: new Date(),
      },
    });
    const detail = await reports.snapshot((tx) =>
      reports.detail(tx, actor, projects[0]),
    );
    assert.ok(detail);
    assert.equal(detail.comments[0].body, null);
    assert.equal(JSON.stringify(detail).includes('storageKey'), false);
    assert.equal(
      await reports.snapshot((tx) => reports.detail(tx, actor, projects[2])),
      null,
    );
  } finally {
    await db.prisma.project.deleteMany({ where: { id: { in: projects } } });
    await db.prisma.university.deleteMany({
      where: { id: { in: universities } },
    });
    if (directionId)
      await db.prisma.direction.delete({ where: { id: directionId } });
    if (programId) await db.prisma.program.delete({ where: { id: programId } });
    await db.prisma.user.deleteMany({ where: { id: { in: users } } });
    await db.onModuleDestroy();
  }
});
