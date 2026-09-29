import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { AddressInfo } from 'node:net';
import { ProjectsController } from '../../projects/controllers/projects.controller.js';
import { ProjectService } from '../../projects/services/project.service.js';
import { ProjectFileService } from '../../projects/services/project-file.service.js';
import { ReportsController } from '../../reports/controllers/reports.controller.js';
import { ReportService } from '../../reports/services/report.service.js';
import { UniversitiesController } from '../../universities/controllers/universities.controller.js';
import { UniversityService } from '../../universities/services/university.service.js';
import { ImportController } from '../../catalog-import/controllers/import.controller.js';
import { ImportService } from '../../catalog-import/services/import.service.js';
import { PermissionsController } from '../../permissions/controllers/permissions.controller.js';
import { PermissionService } from '../../permissions/services/permission.service.js';
import { CommonModule } from '../../../common/common.module.js';

test('HTTP DTO validation and Swagger remain effective without emitted type metadata', async () => {
  let mutations = 0;
  const service = {
    create: async () => {
      mutations++;
      return {};
    },
    configureWorkflow: async () => {
      mutations++;
      return {};
    },
    update: async () => {
      mutations++;
      return {};
    },
    createContact: async () => {
      mutations++;
      return {};
    },
    list: async (_user: unknown, query: unknown) => query,
    get: async (
      _user: unknown,
      _id: string,
      page: number,
      pageSize: number,
    ) => ({ page, pageSize }),
  };
  @Module({
    imports: [CommonModule],
    controllers: [
      ProjectsController,
      ReportsController,
      UniversitiesController,
      ImportController,
      PermissionsController,
    ],
    providers: [
      ProjectService,
      ProjectFileService,
      ReportService,
      UniversityService,
      ImportService,
      PermissionService,
    ].map((provide) => ({ provide, useValue: service })),
  })
  class HttpFixture {}
  const app = await NestFactory.create(HttpFixture, { logger: false });
  app.use((request: object, _response: unknown, next: () => void) => {
    Object.assign(request, {
      user: { id: 'actor', subject: 'subject', level: 30 },
    });
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const port = (app.getHttpServer().address() as AddressInfo).port;
  const root = `http://127.0.0.1:${port}/api`;
  const uuid = '11111111-1111-4111-8111-111111111111';
  try {
    const invalid: Array<[string, string, unknown]> = [
      [
        '/projects',
        'POST',
        { universityId: 'invalid', vendor: 42, extra: true },
      ],
      ['/universities', 'POST', { name: 'Valid', extra: true }],
      [
        `/universities/${uuid}/contacts`,
        'POST',
        { name: 'Name', email: 'invalid' },
      ],
      ['/permissions/projects.read', 'PATCH', { minimumLevel: 11 }],
      [
        `/projects/${uuid}/workflow`,
        'PATCH',
        {
          stages: Array.from({ length: 21 }, () => ({
            title: 'X',
            expectedActor: 'KAM',
            documentTypes: [],
          })),
        },
      ],
    ];
    for (const [path, method, body] of invalid) {
      const response = await fetch(root + path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400, path);
    }
    assert.equal(mutations, 0);
    for (const path of [
      '/projects?page=0',
      '/reports/projects?pageSize=101',
      `/catalog-imports/${uuid}?pageSize=0`,
      '/projects?extra=true',
      '/projects/not-a-uuid',
    ]) {
      assert.equal((await fetch(root + path)).status, 400, path);
    }
    assert.deepEqual(await (await fetch(root + '/reports/projects')).json(), {
      page: 1,
      pageSize: 25,
    });
    assert.deepEqual(
      await (await fetch(root + '/projects?page=2&pageSize=10')).json(),
      { page: 2, pageSize: 10 },
    );
    assert.deepEqual(
      await (await fetch(root + `/catalog-imports/${uuid}`)).json(),
      { page: 1, pageSize: 25 },
    );
    const api = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    assert.ok(api.paths['/api/projects'].post?.requestBody);
    assert.ok(
      api.paths['/api/projects'].get?.parameters?.some(
        (parameter) => 'name' in parameter && parameter.name === 'pageSize',
      ),
    );
    assert.ok(
      api.paths['/api/projects/{id}'].get?.parameters?.some(
        (parameter) =>
          'name' in parameter && parameter.name === 'id' && parameter.required,
      ),
    );
    assert.ok(api.components?.schemas?.CreateProjectDto);
  } finally {
    await app.close();
  }
});
