import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { KeycloakTokenAdapter } from '../../../integrations/keycloak/token.adapter.js';

test('token verification uses the configured realm for JWKS and issuer', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'realm-test';
  const server = createServer((request, response) => {
    assert.equal(
      request.url,
      '/realms/hackathon/protocol/openid-connect/certs',
    );
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const previous = {
    realm: process.env.KEYCLOAK_REALM,
    publicUrl: process.env.KEYCLOAK_PUBLIC_URL,
    internalUrl: process.env.KEYCLOAK_INTERNAL_URL,
  };
  process.env.KEYCLOAK_REALM = 'hackathon';
  process.env.KEYCLOAK_PUBLIC_URL = 'https://sso.example.test';
  process.env.KEYCLOAK_INTERNAL_URL = `http://127.0.0.1:${address.port}`;
  try {
    const token = await new SignJWT({ azp: 'crm-web' })
      .setProtectedHeader({ alg: 'RS256', kid: 'realm-test' })
      .setIssuer('https://sso.example.test/realms/hackathon')
      .setSubject('employee')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
    const payload = await new KeycloakTokenAdapter().verify(token);
    assert.equal(payload.sub, 'employee');
  } finally {
    for (const [key, value] of [
      ['KEYCLOAK_REALM', previous.realm],
      ['KEYCLOAK_PUBLIC_URL', previous.publicUrl],
      ['KEYCLOAK_INTERNAL_URL', previous.internalUrl],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.close();
    await once(server, 'close');
  }
});
