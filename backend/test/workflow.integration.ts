import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DatabaseService } from '../src/database/database.service.js';
import { ProjectRepository } from '../src/modules/projects/repositories/project.repository.js';
import { ProjectService } from '../src/modules/projects/services/project.service.js';
import type { AuthUser, AuthService } from '../src/modules/auth/index.js';
import type { UniversityService } from '../src/modules/universities/index.js';
import type { KeycloakDirectoryAdapter } from '../src/integrations/keycloak/directory.adapter.js';

test('a PostgreSQL row lock permits only one transition from the same stage', async () => {
  const database = new DatabaseService();
  const repository = new ProjectRepository(database);
  const service = new ProjectService(
    repository,
    {} as UniversityService,
    {} as KeycloakDirectoryAdapter,
    {} as AuthService,
  );
  const suffix = randomUUID();
  let projectId: string | undefined;
  let universityId: string | undefined;
  let directionId: string | undefined;
  let programId: string | undefined;
  let userId: string | undefined;
  try {
    const user = await database.prisma.user.create({
      data: { keycloakSubject: suffix },
    });
    userId = user.id;
    const actor: AuthUser = { id: user.id, subject: suffix, level: 10 };
    const direction = await database.prisma.direction.create({
      data: { name: `test-direction-${suffix}` },
    });
    directionId = direction.id;
    const program = await database.prisma.program.create({
      data: { name: `test-program-${suffix}` },
    });
    programId = program.id;
    const university = await database.prisma.university.create({
      data: {
        name: `test-university-${suffix}`,
        createdById: user.id,
        assignments: { create: { userId: user.id } },
      },
    });
    universityId = university.id;
    const project = await repository.create(
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
    projectId = project.id;
    const first = (await repository.find(project.id))?.stages[0];
    assert.ok(first);
    const results = await Promise.allSettled([
      service.advance(actor, project.id, { expectedStageId: first.id }),
      service.advance(actor, project.id, { expectedStageId: first.id }),
    ]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal((await repository.find(project.id))?.currentStageIndex, 1);
    const events = await repository.listEvents(project.id);
    assert.equal(
      events.filter((event) => event.type === 'STAGE_ADVANCED').length,
      1,
    );
    assert.equal(
      await repository.findVisible({ ...actor, id: randomUUID() }, project.id),
      null,
    );
  } finally {
    if (projectId)
      await database.prisma.project.delete({ where: { id: projectId } });
    if (universityId)
      await database.prisma.university.delete({ where: { id: universityId } });
    if (directionId)
      await database.prisma.direction.delete({ where: { id: directionId } });
    if (programId)
      await database.prisma.program.delete({ where: { id: programId } });
    if (userId) await database.prisma.user.delete({ where: { id: userId } });
    await database.onModuleDestroy();
  }
});
