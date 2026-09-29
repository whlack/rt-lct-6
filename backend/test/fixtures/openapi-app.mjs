import 'reflect-metadata';
import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Module, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  PATH_METADATA,
  METHOD_METADATA,
  SELF_DECLARED_DEPS_METADATA,
} from '@nestjs/common/constants.js';

/** Реальные контроллеры с инертными зависимостями: создание документа не требует БД и credentials. */
export async function fixture(mode = 'src') {
  const root = fileURLToPath(new URL(`../../${mode}/`, import.meta.url));
  const controllers = [];
  for (const domain of await readdir(resolve(root, 'modules'))) {
    const directory = resolve(root, 'modules', domain, 'controllers');
    let files;
    try {
      files = await readdir(directory);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      continue;
    }
    for (const file of files.filter((name) =>
      name.endsWith(mode === 'src' ? '.controller.ts' : '.controller.js'),
    )) {
      const exports = await import(
        pathToFileURL(resolve(directory, file)).href
      );
      controllers.push(
        ...Object.values(exports).filter(
          (value) =>
            typeof value === 'function' &&
            Reflect.hasMetadata(PATH_METADATA, value),
        ),
      );
    }
  }
  const providers = new Map();
  for (const controller of controllers) {
    for (const dependency of Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      controller,
    ) ?? []) {
      providers.set(dependency.param, {
        provide: dependency.param,
        useValue:
          dependency.param.name === 'StatusService'
            ? {
                health: () => ({ status: 'ok' }),
                ready: async () => ({ status: 'ok' }),
                publicConfig: () => ({
                  keycloak: {
                    url: 'http://localhost:8080',
                    realm: 'crm',
                    clientId: 'crm-web',
                  },
                }),
              }
            : {},
      });
    }
  }
  class DocumentationFixture {}
  Module({ controllers, providers: [...providers.values()] })(
    DocumentationFixture,
  );
  const app = await NestFactory.create(DocumentationFixture, { logger: false });
  const { createApiDocument, setupOpenApi } = await import(
    pathToFileURL(
      resolve(root, 'openapi/setup.' + (mode === 'src' ? 'ts' : 'js')),
    ).href
  );
  const routes = [];
  for (const controller of controllers) {
    const base = Reflect.getMetadata(PATH_METADATA, controller);
    for (const method of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = controller.prototype[method];
      const verb = Reflect.getMetadata(METHOD_METADATA, handler);
      if (verb === undefined) continue;
      const sub = Reflect.getMetadata(PATH_METADATA, handler);
      const path = (
        '/' + [base, sub].filter((part) => part && part !== '/').join('/')
      ).replace(/:([^/]+)/g, '{$1}');
      routes.push({ path, method: RequestMethod[verb].toLowerCase() });
    }
  }
  return { app, routes, createApiDocument, setupOpenApi };
}
