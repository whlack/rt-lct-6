import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { PermissionService } from './permission.service.js';
import type { PermissionRepository } from '../repositories/permission.repository.js';
import type { AuthUser } from '../../auth/auth.types.js';

const kam: AuthUser = { id: 'kam', subject: 'kam-subject', level: 10 };
const supervisor: AuthUser = { ...kam, level: 20 };
const admin: AuthUser = { ...kam, level: 30 };

test('permission levels are read from the database while management remains administrator-only', async () => {
  let minimumLevel = 20;
  const repository = {
    find: async (key: string) =>
      key === 'projects.close'
        ? { key, minimumLevel }
        : key === 'permissions.manage'
          ? { key, minimumLevel: 10 }
          : null,
    findAll: async () => [
      { key: 'projects.close', minimumLevel },
      { key: 'permissions.manage', minimumLevel: 10 },
    ],
    update: async (_key: string, level: number) => {
      minimumLevel = level;
      return { minimumLevel };
    },
  } as unknown as PermissionRepository;
  const service = new PermissionService(repository);
  assert.equal(await service.can(kam, 'projects.close'), false);
  assert.equal(await service.can(supervisor, 'projects.close'), true);
  assert.equal(await service.can(supervisor, 'permissions.manage'), false);
  assert.equal(await service.can(admin, 'permissions.manage'), true);
  assert.equal(await service.can(admin, 'missing.key'), false);
  assert.deepEqual(await service.effectiveKeys(supervisor), ['projects.close']);
  assert.deepEqual(await service.effectiveKeys(admin), [
    'projects.close',
    'permissions.manage',
  ]);
  await service.update('projects.close', 30);
  assert.equal(await service.can(supervisor, 'projects.close'), false);
  await assert.rejects(
    service.update('permissions.manage', 10),
    ForbiddenException,
  );
});
