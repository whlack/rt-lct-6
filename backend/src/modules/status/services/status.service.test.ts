import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { StatusModule } from '../status.module.js';
import { StatusController } from '../controllers/status.controller.js';
import { StatusService } from './status.service.js';

test('readiness reflects database availability', async () => {
  const available = new StatusService({ isReady: async () => true });
  const unavailable = new StatusService({ isReady: async () => false });
  assert.deepEqual(available.health(), { status: 'ok' });
  assert.deepEqual(await available.ready(), { status: 'ok' });
  assert.deepEqual(await unavailable.ready(), { status: 'unavailable' });
});

test('Nest resolves the public status controller', async () => {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL ??=
    'postgresql://unused:unused@localhost:5432/unused';

  try {
    const app = await NestFactory.createApplicationContext(StatusModule, {
      logger: false,
    });
    assert.ok(app.get(StatusController));
    await app.close();
  } finally {
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
  }
});

test('browser configuration is an allowlist and contains no service credentials', () => {
  const service = new StatusService({ isReady: async () => true });
  assert.deepEqual(Object.keys(service.publicConfig()), ['keycloak']);
  assert.deepEqual(Object.keys(service.publicConfig().keycloak).sort(), [
    'clientId',
    'realm',
    'url',
  ]);
  assert.equal(service.publicConfig().keycloak.realm, 'crm');
});
