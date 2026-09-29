import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectService } from './project.service.js';
import type {
  ProjectRepository,
  ProjectView,
  LockedProject,
  ProjectEventInput,
} from '../repositories/project.repository.js';
import type { UniversityService } from '../../universities/index.js';
import type { KeycloakDirectoryAdapter } from '../../../integrations/keycloak/directory.adapter.js';
import type { AuthService, AuthUser } from '../../auth/index.js';

const user: AuthUser = { id: 'actor', subject: 'subject', level: 10 };
const supervisor: AuthUser = { ...user, level: 20 };

function harness() {
  const stages = [
    { id: 'first', position: 0, title: 'First', files: [], documentTypes: [] },
    {
      id: 'second',
      position: 1,
      title: 'Second',
      files: [],
      documentTypes: [],
    },
  ];
  const project = {
    id: 'project',
    universityId: 'university',
    responsibleId: user.id,
    currentStageIndex: 0,
    workflowLocked: false,
    closedAt: null,
    stages,
  } as unknown as ProjectView;
  const events: ProjectEventInput[] = [];
  let missing: string[] = [];
  let queue = Promise.resolve();
  const locked = {
    project,
    hasScope: async (actor: AuthUser) =>
      actor.level >= 20 || actor.id === project.responsibleId,
    missingRequired: async () => missing,
    update: async (data: {
      currentStageIndex?: { increment: number };
      workflowLocked?: boolean;
      closedAt?: Date;
    }) => {
      if (data.currentStageIndex)
        project.currentStageIndex += data.currentStageIndex.increment;
      if (data.workflowLocked !== undefined)
        project.workflowLocked = data.workflowLocked;
      if (data.closedAt) project.closedAt = data.closedAt;
      return project;
    },
    event: async (event: ProjectEventInput) => {
      events.push(event);
    },
  } as unknown as LockedProject;
  const repository = {
    findVisible: async (actor: AuthUser) =>
      actor.id === user.id || actor.level >= 20 ? project : null,
    withLock: <T>(
      _id: string,
      operation: (value: LockedProject | null) => Promise<T>,
    ): Promise<T> => {
      // The double request test models the repository's row lock and checks service behavior after it is released.
      const result = queue.then(() => operation(locked));
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    listEvents: async () => events,
    findComment: async () => ({
      projectId: project.id,
      authorId: 'another-user',
      deletedAt: null,
    }),
  } as unknown as ProjectRepository;
  const service = new ProjectService(
    repository,
    { get: async () => ({}) } as unknown as UniversityService,
    { isKam: async () => true } as unknown as KeycloakDirectoryAdapter,
    { ensureUser: async () => 'actor' } as unknown as AuthService,
  );
  return {
    service,
    project,
    events,
    setMissing: (value: string[]) => {
      missing = value;
    },
  };
}

test('only visible projects are returned', async () => {
  const { service } = harness();
  await assert.rejects(
    service.getVisible({ ...user, id: 'outsider' }, 'project'),
    NotFoundException,
  );
  assert.equal((await service.getVisible(user, 'project')).id, 'project');
});

test('required documents block transition and simultaneous requests advance once', async () => {
  const { service, project, events, setMissing } = harness();
  setMissing(['license']);
  await assert.rejects(
    service.advance(user, project.id, { expectedStageId: 'first' }),
    ConflictException,
  );
  assert.equal(project.currentStageIndex, 0);
  setMissing([]);
  const results = await Promise.allSettled([
    service.advance(user, project.id, { expectedStageId: 'first' }),
    service.advance(user, project.id, { expectedStageId: 'first' }),
  ]);
  assert.deepEqual(
    results.map((result) => result.status),
    ['fulfilled', 'rejected'],
  );
  assert.equal(project.currentStageIndex, 1);
  assert.deepEqual(
    events.map((event) => event.type),
    ['STAGE_ADVANCED'],
  );
  assert.deepEqual(events[0]?.details, {
    from: 'first',
    to: 'second',
    fromTitle: 'First',
    toTitle: 'Second',
  });
});

test('transition checks access and closed state inside the project lock', async () => {
  const { service, project, events } = harness();
  await assert.rejects(
    service.advance({ ...user, id: 'outsider' }, project.id, {
      expectedStageId: 'first',
    }),
    ForbiddenException,
  );
  project.closedAt = new Date();
  await assert.rejects(
    service.advance(user, project.id, { expectedStageId: 'first' }),
    ConflictException,
  );
  assert.equal(project.currentStageIndex, 0);
  assert.deepEqual(events, []);
});

test('workflow cannot be changed after the first transition', async () => {
  const { service, project } = harness();
  project.workflowLocked = true;
  await assert.rejects(
    service.configureWorkflow(supervisor, project.id, {
      stages: [{ title: 'Updated', expectedActor: 'KAM', documentTypes: [] }],
    }),
    ConflictException,
  );
});

test('only a supervisor closes after the last stage and records the event', async () => {
  const { service, project, events, setMissing } = harness();
  await assert.rejects(service.close(user, project.id), ForbiddenException);
  await assert.rejects(
    service.close(supervisor, project.id),
    ConflictException,
  );
  project.currentStageIndex = 1;
  setMissing(['report']);
  await assert.rejects(
    service.close(supervisor, project.id),
    ConflictException,
  );
  setMissing([]);
  await service.close(supervisor, project.id);
  assert.ok(project.closedAt);
  assert.deepEqual(
    events.map((event) => event.type),
    ['PROJECT_CLOSED'],
  );
});

test('another author cannot edit a comment without supervisor role', async () => {
  const { service } = harness();
  await assert.rejects(
    service.editComment(user, 'project', 'comment', 'new text'),
    ForbiddenException,
  );
});
