import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  type INestApplication,
  RequestMethod,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  OpenAPIObject,
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger';
import { IS_PUBLIC } from '../../auth/decorators/public.decorator.js';
import { Reflector } from '@nestjs/core';

interface Fixture {
  app: INestApplication;
  routes: { path: string; method: string }[];
  createApiDocument(app: INestApplication): OpenAPIObject;
  setupOpenApi(app: INestApplication, environment: string): void;
}
async function fixture(): Promise<Fixture> {
  // Одна фикстура импортирует реальные контроллеры из src и dist для проверки совпадения контрактов.
  const module = await import(
    pathToFileURL(resolve('test/fixtures/openapi-app.mjs')).href
  );
  return module.fixture();
}
const methods = Object.values(RequestMethod)
  .filter((value): value is string => typeof value === 'string')
  .map((value) => value.toLowerCase());

function schemas(document: OpenAPIObject) {
  const visit = (schema: SchemaObject | ReferenceObject): void => {
    if ('$ref' in schema) {
      assert.ok(
        document.components?.schemas?.[
          schema.$ref.replace('#/components/schemas/', '')
        ],
        schema.$ref,
      );
      return;
    }
    for (const [name, child] of Object.entries(schema.properties ?? {})) {
      if (!('$ref' in child))
        assert.ok(child.description, `Missing field description: ${name}`);
      visit(child);
    }
    if (schema.items) visit(schema.items);
    for (const child of [
      ...(schema.allOf ?? []),
      ...(schema.oneOf ?? []),
      ...(schema.anyOf ?? []),
    ])
      visit(child);
  };
  for (const value of Object.values(document.components?.schemas ?? {}))
    visit(value);
  return visit;
}

/** Проверяет примеры против объявленных схем, включая null и вложенные модели. */
function assertExample(
  schema: SchemaObject | ReferenceObject,
  value: unknown,
  document: OpenAPIObject,
): void {
  if ('$ref' in schema) {
    const target =
      document.components?.schemas?.[
        schema.$ref.replace('#/components/schemas/', '')
      ];
    assert.ok(target);
    return assertExample(target, value, document);
  }
  if (value === null) {
    assert.ok(schema.nullable, 'Unexpected null');
    return;
  }
  if (schema.enum)
    assert.ok(schema.enum.includes(value), `Invalid enum value: ${value}`);
  if (schema.allOf)
    for (const part of schema.allOf) assertExample(part, value, document);
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((part) => {
      try {
        assertExample(part, value, document);
        return true;
      } catch {
        return false;
      }
    });
    assert.equal(matches.length, 1, 'oneOf example');
    return;
  }
  if (schema.type === 'object' || schema.properties) {
    assert.ok(
      typeof value === 'object' && !Array.isArray(value) && value !== null,
    );
    for (const key of schema.required ?? [])
      assert.ok(key in value, `Missing example key: ${key}`);
    for (const [key, child] of Object.entries(schema.properties ?? {}))
      if (key in value) assertExample(child, Reflect.get(value, key), document);
  } else if (schema.type === 'array') {
    assert.ok(Array.isArray(value));
    if (schema.minItems !== undefined)
      assert.ok(value.length >= schema.minItems);
    if (schema.maxItems !== undefined)
      assert.ok(value.length <= schema.maxItems);
    if (schema.items)
      for (const child of value) assertExample(schema.items, child, document);
  } else if (schema.type === 'number' || schema.type === 'integer') {
    assert.equal(typeof value, 'number');
    assert.ok(typeof value === 'number');
    if (schema.type === 'integer') assert.ok(Number.isInteger(value));
    if (schema.minimum !== undefined) assert.ok(value >= schema.minimum);
    if (schema.maximum !== undefined) assert.ok(value <= schema.maximum);
  } else if (schema.type === 'boolean') assert.equal(typeof value, 'boolean');
  else if (schema.type === 'string') {
    assert.equal(typeof value, 'string');
    assert.ok(typeof value === 'string');
    if (schema.minLength !== undefined)
      assert.ok(value.length >= schema.minLength);
    if (schema.maxLength !== undefined)
      assert.ok(value.length <= schema.maxLength);
    if (schema.format === 'uuid')
      assert.match(
        value,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    if (schema.format === 'date-time')
      assert.ok(Number.isFinite(Date.parse(value)) && value.includes('T'));
    if (schema.format === 'date') assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
  }
}

test('OpenAPI covers every registered NestJS operation, response, security and schema reference', async () => {
  const { app, routes, createApiDocument } = await fixture();
  try {
    const document = createApiDocument(app);
    const visit = schemas(document);
    const expected = routes
      .map(({ method, path }) => `${method} ${path}`)
      .sort();
    const actual: string[] = [];
    const identifiers = new Set();
    for (const [path, item] of Object.entries(document.paths)) {
      for (const method of methods) {
        const operation = item?.[method as 'get'];
        if (!operation) continue;
        actual.push(`${method} ${path}`);
        assert.ok(
          operation.summary && operation.description,
          `${method} ${path}`,
        );
        assert.ok(operation.operationId);
        assert.ok(!identifiers.has(operation.operationId));
        identifiers.add(operation.operationId);
        const success = Object.entries(operation.responses).filter(
          ([status]) => Number(status) >= 200 && Number(status) < 300,
        );
        assert.ok(success.length, path);
        for (const [, response] of success) {
          assert.ok(response && !('$ref' in response));
          assert.ok(
            response.description &&
              response.content &&
              Object.keys(response.content).length,
            path,
          );
          for (const [mime, media] of Object.entries(response.content)) {
            assert.ok(media.schema, path);
            visit(media.schema);
            if (mime === 'application/json')
              assert.notEqual(media.example, undefined, path);
          }
        }
        for (const response of Object.values(operation.responses)) {
          if (!response || '$ref' in response) continue;
          for (const [mime, media] of Object.entries(response.content ?? {})) {
            if (!media.schema) continue;
            visit(media.schema);
            if (mime === 'application/json' && media.example !== undefined)
              assertExample(media.schema, media.example, document);
          }
        }
        const isPublic = ['/api/health', '/api/ready', '/api/config'].includes(
          path,
        );
        assert.equal(Boolean(operation.security?.length), !isPublic, path);
        if (!isPublic) assert.ok(operation.responses['401']);
        const parameterKeys = (operation.parameters ?? []).map((param) =>
          '$ref' in param ? param.$ref : `${param.in}:${param.name}`,
        );
        assert.equal(
          new Set(parameterKeys).size,
          parameterKeys.length,
          `Duplicate parameter in ${path}`,
        );
        for (const param of operation.parameters ?? []) {
          if ('$ref' in param) continue;
          assert.ok(param.description, `${path} ${param.name}`);
          if (param.in === 'path') assert.equal(param.required, true);
          if (param.schema) visit(param.schema);
        }
        if (operation.requestBody && !('$ref' in operation.requestBody)) {
          for (const media of Object.values(operation.requestBody.content))
            if (media.schema) {
              visit(media.schema);
              for (const sample of Object.values(media.examples ?? {}))
                if (!('$ref' in sample))
                  assertExample(media.schema, sample.value, document);
            }
        }
      }
    }
    assert.deepEqual(actual.sort(), expected);
    const projectBody = document.paths['/api/projects']?.post?.requestBody;
    assert.ok(projectBody && !('$ref' in projectBody));
    assert.deepEqual(
      Object.keys(projectBody.content['application/json'].examples ?? {}),
      ['program', 'product'],
    );
    const upload = document.paths['/api/catalog-imports']?.post?.requestBody;
    assert.ok(
      upload && !('$ref' in upload) && upload.content['multipart/form-data'],
    );
    const download =
      document.paths['/api/jobs/{id}/file']?.get?.responses['200'];
    assert.ok(
      download &&
        !('$ref' in download) &&
        download.content?.['application/pdf'] &&
        download.headers?.['Content-Disposition'],
    );
    const permission = document.components?.schemas?.UpdatePermissionDto;
    assert.ok(permission && !('$ref' in permission));
    assert.deepEqual(
      permission.properties?.minimumLevel &&
        !('$ref' in permission.properties.minimumLevel)
        ? permission.properties.minimumLevel.enum
        : undefined,
      [10, 20, 30],
    );
    assert.deepEqual(
      document.paths['/api/ready']?.get?.responses['503'] &&
        'content' in document.paths['/api/ready']!.get!.responses['503']!
        ? document.paths['/api/ready']!.get!.responses['503']!.content?.[
            'application/json'
          ]?.example
        : undefined,
      { status: 'unavailable' },
    );
  } finally {
    await app.close();
  }
});

for (const environment of ['development', 'test', 'staging', 'production']) {
  test(`Swagger routes and assets in ${environment}`, async () => {
    const { app, setupOpenApi } = await fixture();
    // Guard isolates documentation routing from Keycloak; actual authorization is covered by integration tests.
    app.useGlobalGuards({
      canActivate(context) {
        if (
          new Reflector().getAllAndOverride(IS_PUBLIC, [
            context.getHandler(),
            context.getClass(),
          ])
        )
          return true;
        throw new UnauthorizedException('Bearer token required');
      },
    });
    setupOpenApi(app, environment);
    await app.listen(0, '127.0.0.1');
    try {
      const base = await app.getUrl();
      for (const path of [
        '/api/docs',
        '/api/docs-json',
        '/api/docs-yaml',
        '/api/docs/swagger-ui-init.js',
        '/api/docs/swagger-ui.css',
        '/api/docs/swagger-ui-bundle.js',
      ]) {
        const response = await fetch(base + path, {
          signal: AbortSignal.timeout(5000),
        });
        assert.equal(
          response.status,
          environment === 'production' ? 404 : 200,
          path,
        );
        if (environment !== 'production' && path === '/api/docs-json')
          assert.ok((await response.json()).paths['/api/projects']);
        else await response.arrayBuffer();
      }
      assert.equal(
        (
          await fetch(base + '/api/health', {
            signal: AbortSignal.timeout(5000),
          })
        ).status,
        200,
      );
      assert.equal(
        (await fetch(base + '/api/me', { signal: AbortSignal.timeout(5000) }))
          .status,
        401,
      );
    } finally {
      await app.close();
    }
  });
}
