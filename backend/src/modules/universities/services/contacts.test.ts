import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UniversityService } from './university.service.js';

test('clearing an optional contact channel preserves the other and cannot remove both', async () => {
  let saved: unknown;
  const repository = {
    find: async () => ({ id: 'u' }),
    isVisible: async () => true,
    findContact: async () => ({
      universityId: 'u',
      email: 'old@example.test',
      phone: '+79990000000',
    }),
    updateContact: async (_id: string, data: unknown) => {
      saved = data;
      return data;
    },
  };
  const service = new UniversityService(repository, {}, {});
  const user = { id: 'actor', subject: 'actor', level: 30 as const };
  await service.updateContact(user, 'u', 'c', { name: 'Contact', email: null });
  assert.deepEqual(saved, {
    name: 'Contact',
    email: null,
    phone: '+79990000000',
  });
  await assert.rejects(
    service.updateContact(user, 'u', 'c', {
      name: 'Contact',
      email: null,
      phone: null,
    }),
  );
});
