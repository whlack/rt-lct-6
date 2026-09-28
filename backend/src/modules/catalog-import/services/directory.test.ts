import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KeycloakDirectoryAdapter } from '../../../integrations/keycloak/directory.adapter.js';
test('exact email search follows pagination and keeps ambiguous enabled matches', async () => {
  const original = globalThis.fetch;
  const previousAdmin = process.env.KEYCLOAK_ADMIN,
    previousPassword = process.env.KEYCLOAK_ADMIN_PASSWORD;
  process.env.KEYCLOAK_ADMIN = 'fixture';
  process.env.KEYCLOAK_ADMIN_PASSWORD = 'fixture';
  const firstValues: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/token'))
      return Response.json({ access_token: 'fixture' });
    assert.equal(url.searchParams.get('exact'), 'true');
    firstValues.push(url.searchParams.get('first')!);
    return Response.json(
      url.searchParams.get('first') === '0'
        ? Array.from({ length: 100 }, (_, i) => ({
            id: String(i),
            email: i === 99 ? 'NAME@example.test' : i + '@example.test',
            enabled: true,
          }))
        : [
            { id: 'another', email: 'name@example.test', enabled: true },
            { id: 'disabled', email: 'name@example.test', enabled: false },
          ],
    );
  };
  try {
    const matches = await new KeycloakDirectoryAdapter().findEmail(
      'name@example.test',
    );
    assert.deepEqual(
      matches.map((m) => m.subject),
      ['99', 'another'],
    );
    assert.deepEqual(firstValues, ['0', '100']);
  } finally {
    globalThis.fetch = original;
    if (previousAdmin === undefined) delete process.env.KEYCLOAK_ADMIN;
    else process.env.KEYCLOAK_ADMIN = previousAdmin;
    if (previousPassword === undefined)
      delete process.env.KEYCLOAK_ADMIN_PASSWORD;
    else process.env.KEYCLOAK_ADMIN_PASSWORD = previousPassword;
  }
});
