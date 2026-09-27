import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { ProjectFileService } from './project-file.service.js';
import type { ProjectService } from './project.service.js';
import type {
  ProjectRepository,
  ProjectView,
} from '../repositories/project.repository.js';
import type { S3Adapter } from '../../../integrations/storage/s3.adapter.js';
import type { AuthUser } from '../../auth/index.js';

const user: AuthUser = {
  id: 'local-user',
  subject: 'keycloak-user',
  level: 10,
};

test('file download checks the project and stage before reading object storage', async () => {
  let reads = 0;
  const project = {
    id: 'project',
    stages: [{ id: 'stage' }],
  } as unknown as ProjectView;
  const projects = {
    getVisible: async () => project,
  } as unknown as ProjectService;
  const repository = {
    findFile: async () => ({
      stageId: 'other-stage',
      storageKey: 'private-key',
    }),
  } as unknown as ProjectRepository;
  const storage = {
    get: async () => {
      reads += 1;
      return new Uint8Array([1, 2, 3]);
    },
  } as unknown as S3Adapter;
  const service = new ProjectFileService(projects, repository, storage);
  await assert.rejects(
    service.download(user, 'project', 'file'),
    NotFoundException,
  );
  assert.equal(reads, 0);
});
