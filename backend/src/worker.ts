import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { createServer } from 'node:http';
import { WorkerModule } from './worker/worker.module.js';
import { WorkerService } from './worker/worker.service.js';
import { DatabaseService } from './database/database.service.js';
import { metrics } from './common/metrics.js';

const app = await NestFactory.createApplicationContext(WorkerModule);
app.enableShutdownHooks();
const worker = app.get(WorkerService);
const database = app.get(DatabaseService);
const server = createServer((request, response) => {
  if (request.url === '/metrics') {
    void metrics.metrics().then((body) => {
      response.writeHead(200, { 'content-type': metrics.contentType });
      response.end(body);
    });
    return;
  }
  void Promise.all([worker.healthy(), database.isReady()])
    .then((results) => {
      response.writeHead(results.every(Boolean) ? 200 : 503, {
        'content-type': 'application/json',
      });
      response.end(
        JSON.stringify({
          status: results.every(Boolean) ? 'ok' : 'unavailable',
        }),
      );
    })
    .catch(() => {
      response.writeHead(503);
      response.end();
    });
});
server.listen(Number(process.env.WORKER_HEALTH_PORT ?? 3001), '0.0.0.0');
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
