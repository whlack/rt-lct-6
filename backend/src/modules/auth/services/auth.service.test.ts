import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthService } from './auth.service.js';

test('requires a CRM role and maps the highest role level', async () => {
  let capturedProfile: { name?: string; email?: string } | undefined;
  const users = {
    ensure: async (
      _subject: string,
      profile?: { name?: string; email?: string },
    ) => {
      capturedProfile = profile;
      return 'local-user';
    },
  };
  const tokens = {
    verify: async () => ({
      sub: 'kc-user',
      azp: 'crm-web',
      realm_access: { roles: ['kam', 'supervisor'] },
    }),
  };
  const service = new AuthService(tokens, users);
  assert.equal(service.levelForRoles(['kam']), 10);
  assert.equal(service.levelForRoles(['kam', 'supervisor']), 20);
  assert.equal(service.levelForRoles(['admin', 'kam']), 30);
  assert.deepEqual(await service.authenticate('token'), {
    id: 'local-user',
    subject: 'kc-user',
    level: 20,
    email: undefined,
    name: undefined,
  });
  assert.deepEqual(capturedProfile, { name: undefined, email: undefined });
  await assert.rejects(
    new AuthService(
      { verify: async () => ({ sub: 'kc-user', realm_access: { roles: [] } }) },
      users,
    ).authenticate('token'),
  );
});
