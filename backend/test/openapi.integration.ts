import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { NestFactory, ModulesContainer } from '@nestjs/core';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { createApiDocument, setupOpenApi } from '../src/openapi/setup.js';

/** Реальное приложение подключается только к одноразовому стенду приёмки. */
test('OpenAPI matches compiled/watch contracts and real application routes; production exposes no docs', async () => {
  assert.equal(
    process.env.ACCEPTANCE_ISOLATED,
    '1',
    'Disposable Docker PostgreSQL/Redis required',
  );
  const temporary = await mkdtemp(join(tmpdir(), 'crm-openapi-'));
  try {
    const source = join(temporary, 'source.json');
    const compiled = join(temporary, 'compiled.json');
    execFileSync(
      process.execPath,
      ['--import', 'tsx', 'test/fixtures/openapi-document.mjs', 'src', source],
      { cwd: resolve('.'), timeout: 60000 },
    );
    execFileSync(
      process.execPath,
      ['test/fixtures/openapi-document.mjs', 'dist', compiled],
      { cwd: resolve('.'), timeout: 60000 },
    );
    assert.deepEqual(
      JSON.parse(await readFile(source, 'utf8')),
      JSON.parse(await readFile(compiled, 'utf8')),
      'tsx/compiled OpenAPI drift',
    );
    for (const environment of ['staging', 'production']) {
      const app = await NestFactory.create(AppModule, { logger: false });
      try {
        setupOpenApi(app, environment);
        const document = createApiDocument(app);
        const registered: string[] = [];
        for (const module of app.get(ModulesContainer).values()) {
          for (const controller of module.controllers.values()) {
            if (!controller.metatype) continue;
            const prefix: unknown = Reflect.getMetadata(
              PATH_METADATA,
              controller.metatype,
            );
            assert.equal(typeof prefix, 'string');
            for (const name of Object.getOwnPropertyNames(
              controller.metatype.prototype,
            )) {
              const handler: unknown = controller.metatype.prototype[name];
              if (typeof handler !== 'function') continue;
              const method: unknown = Reflect.getMetadata(
                METHOD_METADATA,
                handler,
              );
              if (typeof method !== 'number') continue;
              const path: unknown = Reflect.getMetadata(PATH_METADATA, handler);
              assert.equal(typeof path, 'string');
              registered.push(
                `${RequestMethod[method].toLowerCase()} /${[prefix, path]
                  .filter((part) => part && part !== '/')
                  .join('/')
                  .replace(/:([^/]+)/g, '{$1}')}`,
              );
            }
          }
        }
        const documented = Object.entries(document.paths).flatMap(
          ([path, item]) =>
            Object.keys(item ?? {})
              .filter((method) =>
                [
                  'get',
                  'post',
                  'put',
                  'patch',
                  'delete',
                  'head',
                  'options',
                ].includes(method),
              )
              .map((method) => `${method} ${path}`),
        );
        assert.deepEqual(documented.sort(), registered.sort());
        await app.listen(0, '0.0.0.0');
        const base = await app.getUrl();
        for (const path of [
          '/api/docs',
          '/api/docs-json',
          '/api/docs-yaml',
          '/api/docs/swagger-ui.css',
          '/api/docs/swagger-ui-init.js',
          '/api/docs/swagger-ui-bundle.js',
        ]) {
          const response = await fetch(base + path, {
            signal: AbortSignal.timeout(10000),
          });
          assert.equal(
            response.status,
            environment === 'production' ? 404 : 200,
            path,
          );
          await response.arrayBuffer();
        }
        assert.equal((await fetch(base + '/api/health')).status, 200);
        assert.equal((await fetch(base + '/api/ready')).status, 200);
        assert.equal((await fetch(base + '/api/config')).status, 200);
        assert.equal((await fetch(base + '/api/me')).status, 401);
      } finally {
        await app.close();
      }
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
