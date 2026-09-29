import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KeycloakDirectoryAdapter } from '../../../integrations/keycloak/directory.adapter.js';

test('assigned employee profile uses Keycloak username when local name is absent', async () => {
  const original = globalThis.fetch;
  const previous = process.env.KEYCLOAK_SERVICE_CLIENT_SECRET;
  process.env.KEYCLOAK_SERVICE_CLIENT_SECRET = 'fixture';
  globalThis.fetch = async (input) => {
    const pathname = new URL(String(input)).pathname;
    if (pathname.endsWith('/token'))
      return Response.json({ access_token: 'fixture' });
    assert.ok(pathname.endsWith('/users/assigned-subject'));
    return Response.json({
      id: 'assigned-subject',
      username: 'kam',
      enabled: true,
    });
  };
  try {
    assert.deepEqual(
      await new KeycloakDirectoryAdapter().profile('assigned-subject'),
      { subject: 'assigned-subject', email: '', name: 'kam' },
    );
  } finally {
    globalThis.fetch = original;
    if (previous === undefined)
      delete process.env.KEYCLOAK_SERVICE_CLIENT_SECRET;
    else process.env.KEYCLOAK_SERVICE_CLIENT_SECRET = previous;
  }
});

test('exact email search follows pagination and keeps ambiguous enabled matches', async () => {
  const original = globalThis.fetch;
  const previousAdmin = process.env.KEYCLOAK_SERVICE_CLIENT_ID,
    previousPassword = process.env.KEYCLOAK_SERVICE_CLIENT_SECRET,
    previousRealm = process.env.KEYCLOAK_REALM;
  process.env.KEYCLOAK_SERVICE_CLIENT_ID = 'fixture';
  process.env.KEYCLOAK_SERVICE_CLIENT_SECRET = 'fixture';
  process.env.KEYCLOAK_REALM = 'hackathon';
  const firstValues: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.ok(url.pathname.includes('/realms/hackathon/'));
    if (url.pathname.endsWith('/token')) {
      assert.ok(!url.pathname.includes('/master/'));
      assert.equal(
        new URLSearchParams(String(init?.body)).get('grant_type'),
        'client_credentials',
      );
      return Response.json({ access_token: 'fixture' });
    }
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
    if (previousAdmin === undefined)
      delete process.env.KEYCLOAK_SERVICE_CLIENT_ID;
    else process.env.KEYCLOAK_SERVICE_CLIENT_ID = previousAdmin;
    if (previousPassword === undefined)
      delete process.env.KEYCLOAK_SERVICE_CLIENT_SECRET;
    else process.env.KEYCLOAK_SERVICE_CLIENT_SECRET = previousPassword;
    if (previousRealm === undefined) delete process.env.KEYCLOAK_REALM;
    else process.env.KEYCLOAK_REALM = previousRealm;
  }
});

test('role directory includes employees past 1000 and bounds every request with a timeout', async () => {
  const original = globalThis.fetch,
    previous = process.env.KEYCLOAK_SERVICE_CLIENT_SECRET;
  process.env.KEYCLOAK_SERVICE_CLIENT_SECRET = 'fixture';
  const offsets: number[] = [];
  globalThis.fetch = async (input, init) => {
    assert.ok(init?.signal);
    const url = new URL(String(input));
    if (url.pathname.endsWith('/token'))
      return Response.json({ access_token: 'fixture' });
    const first = Number(url.searchParams.get('first'));
    offsets.push(first);
    return Response.json(
      Array.from({ length: first < 1000 ? 100 : 1 }, (_, i) => ({
        id: String(first + i),
        email: `${first + i}@example.test`,
        enabled: true,
      })),
    );
  };
  try {
    const people = await new KeycloakDirectoryAdapter().listKam();
    assert.equal(people.length, 1001);
    assert.equal(people[1000].subject, '1000');
    assert.equal(offsets.at(-1), 1000);
  } finally {
    globalThis.fetch = original;
    if (previous === undefined)
      delete process.env.KEYCLOAK_SERVICE_CLIENT_SECRET;
    else process.env.KEYCLOAK_SERVICE_CLIENT_SECRET = previous;
  }
});
