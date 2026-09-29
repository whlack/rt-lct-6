import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { setupOpenApi } from './openapi/setup.js';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { apiDuration } from './common/metrics.js';

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
app.use((request: Request, response: Response, next: NextFunction) => {
  const started = performance.now();
  const supplied = request.header('x-request-id');
  const requestId =
    supplied && /^[a-zA-Z0-9-]{1,64}$/.test(supplied) ? supplied : randomUUID();
  response.setHeader('x-request-id', requestId);
  response.on('finish', () => {
    const route: unknown = request.route;
    const path =
      typeof route === 'object' &&
      route !== null &&
      'path' in route &&
      typeof route.path === 'string'
        ? route.path
        : 'unmatched';
    apiDuration.observe(
      { method: request.method, route: path, status: response.statusCode },
      (performance.now() - started) / 1000,
    );
    console.log(
      JSON.stringify({
        requestId,
        method: request.method,
        route: path,
        result: response.statusCode,
      }),
    );
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
setupOpenApi(app);
await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
