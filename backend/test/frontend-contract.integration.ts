import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DatabaseService } from '../src/database/database.service.js';
import { ProjectRepository } from '../src/modules/projects/repositories/project.repository.js';
import type { AuthUser } from '../src/modules/auth/index.js';
test('project filters, current-stage action queue and activity respect visibility', async () => {
  const database = new DatabaseService();
  const repo = new ProjectRepository(database);
  const suffix = randomUUID();
  const user = await database.prisma.user.create({
    data: {
      keycloakSubject: suffix,
      displayName: 'Source name',
      displayNameOverride: 'Override name',
    },
  });
  const direction = await database.prisma.direction.create({
    data: { name: `frontend-direction-${suffix}` },
  });
  const program = await database.prisma.program.create({
    data: { name: `frontend-program-${suffix}` },
  });
  const university = await database.prisma.university.create({
    data: { name: `frontend-university-${suffix}`, createdById: user.id },
  });
  const ids: string[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      const project = await repo.create(
        {
          universityId: university.id,
          directionId: direction.id,
          programId: program.id,
          responsibleId: user.id,
          createdById: user.id,
        },
        ['First', 'Second'],
        user.id,
      );
      ids.push(project.id);
    }
    await database.prisma.project.update({
      where: { id: ids[1] },
      data: { currentStageIndex: 1 },
    });
    await database.prisma.projectStage.updateMany({
      where: { projectId: ids[1], position: 1 },
      data: { expectedActor: 'UNIVERSITY' },
    });
    await database.prisma.project.update({
      where: { id: ids[2] },
      data: { closedAt: new Date() },
    });
    const actor: AuthUser = {
      id: user.id,
      subject: suffix,
      level: 10,
      visibility: {
        mode: 'SELECTED',
        universityIds: [],
        projectIds: [ids[0], ids[1]],
      },
    };
    const queue = await repo.list(actor, {
      page: 1,
      pageSize: 1,
      actionRequired: 'true',
      universityId: university.id,
      search: suffix,
    });
    assert.equal(queue.total, 1);
    assert.equal(queue.rows[0].id, ids[0]);
    assert.equal(queue.rows[0].responsible.displayName, 'Override name');
    assert.equal(queue.rows[0].stageCount, 2);
    assert.equal(queue.rows[0].currentStage?.expectedActor, 'KAM');
    const second = await repo.list(actor, {
      page: 2,
      pageSize: 1,
      actionRequired: 'true',
    });
    assert.equal(second.total, 1);
    assert.equal(second.rows.length, 0);
    assert.equal(
      (await repo.list(actor, { page: 1, pageSize: 25, status: 'CLOSED' }))
        .total,
      0,
    );
    assert.equal(
      (
        await repo.list(actor, {
          page: 1,
          pageSize: 25,
          search: 'not-present-' + suffix,
        })
      ).total,
      0,
    );
    const events = await repo.activity(actor);
    assert.ok(events.length > 0);
    assert.ok(
      events.every((event) =>
        actor.visibility!.projectIds.includes(event.project.id),
      ),
    );
    const denied = {
      ...actor,
      visibility: {
        mode: 'SELECTED' as const,
        universityIds: [],
        projectIds: [],
      },
    };
    assert.equal((await repo.activity(denied)).length, 0);
    assert.equal(
      (
        await repo.list(denied, {
          page: 1,
          pageSize: 25,
          actionRequired: 'true',
        })
      ).total,
      0,
    );
  } finally {
    await database.prisma.project.deleteMany({ where: { id: { in: ids } } });
    await database.prisma.university.delete({ where: { id: university.id } });
    await database.prisma.program.delete({ where: { id: program.id } });
    await database.prisma.direction.delete({ where: { id: direction.id } });
    await database.prisma.user.delete({ where: { id: user.id } });
    await database.onModuleDestroy();
  }
});
