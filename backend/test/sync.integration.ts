import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import {
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Worker, Queue } from 'bullmq';
import { DatabaseService } from '../src/database/database.service.js';
import { AppModule } from '../src/app.module.js';
import { UserRepository } from '../src/modules/auth/repositories/user.repository.js';
import { PermissionRepository } from '../src/modules/permissions/repositories/permission.repository.js';
import { PermissionService } from '../src/modules/permissions/services/permission.service.js';
import { BackgroundIdentityService } from '../src/modules/jobs/index.js';
import { KeycloakDirectoryAdapter } from '../src/integrations/keycloak/directory.adapter.js';
import { AuthService, type AuthUser } from '../src/modules/auth/index.js';
import { SyncRepository } from '../src/modules/integration-sync/repositories/sync.repository.js';
import { SyncRegistry } from '../src/modules/integration-sync/services/sync-registry.service.js';
import { SyncService } from '../src/modules/integration-sync/services/sync.service.js';
import { SyncProcessor } from '../src/modules/integration-sync/services/sync-processor.service.js';
import { SyncQueueService } from '../src/modules/integration-sync/services/sync-queue.service.js';
import { WebsiteAdapter } from '../src/integrations/website/website.adapter.js';
import {
  SyncFailure,
  type SyncAdapter,
} from '../src/integrations/sync-adapter.js';
import { redisConnection } from '../src/config/jobs.js';

async function until(check: () => Promise<boolean>, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('Timed out waiting for synchronization');
}

test('sync API, leases, retries, scheduling and queue recovery on isolated PostgreSQL/Redis', async () => {
  if (process.env.ACCEPTANCE_ISOLATED !== '1')
    throw new Error(
      'Sync integration tests require ACCEPTANCE_ISOLATED=1 and a disposable PostgreSQL/Redis without an ordinary worker',
    );
  const db = new DatabaseService();
  const repo = new SyncRepository(db);
  const suffix = randomUUID();
  const owner = await db.prisma.user.create({
    data: { keycloakSubject: 'sync-' + suffix },
  });
  const user: AuthUser = {
    id: owner.id,
    subject: owner.keycloakSubject,
    level: 20,
  };
  const originalAuth = AuthService.prototype.authenticate;
  let worker: Worker | undefined;
  let child: ChildProcess | undefined;
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  const outbox = new SyncQueueService(repo);
  const queue = new Queue('crm-sync', { connection: redisConnection() });
  let calls = 0;
  let mode: 'ok' | 'temporary' | 'invalid' = 'ok';
  let allowed = true;
  const adapter: SyncAdapter = {
    source: 'LMS',
    availability: 'READY',
    execute: async () => {
      calls++;
      if (mode === 'temporary')
        throw new SyncFailure('TEMPORARY_FAILURE', true, 60000);
      if (mode === 'invalid') throw new SyncFailure('INVALID_DATA');
    },
  };
  const registry = new SyncRegistry([adapter, new WebsiteAdapter()]);
  const service = new SyncService(registry, repo);
  class TestDirectory extends KeycloakDirectoryAdapter {
    override async identity() {
      return { enabled: allowed, roles: ['supervisor'] };
    }
  }
  const backgroundAuth = new AuthService(
    {
      verify: async () => {
        throw new Error('Unused token adapter');
      },
    },
    new UserRepository(db),
  );
  const identities = new BackgroundIdentityService(
    new TestDirectory(),
    backgroundAuth,
    new PermissionService(new PermissionRepository(db)),
  );
  const processor = new SyncProcessor(repo, registry, identities);
  const terminate = async (id: string) => {
    await db.prisma.integrationSyncRun.update({
      where: { id },
      data: { status: 'FAILED', completedAt: new Date(), leaseUntil: null },
    });
  };
  try {
    await db.prisma.permission.createMany({
      data: [
        { key: 'integrations.manage', minimumLevel: 20 },
        { key: 'integrations.sync', minimumLevel: 20 },
      ],
      skipDuplicates: true,
    });
    await db.prisma.permission.update({
      where: { key: 'integrations.sync' },
      data: { minimumLevel: 30 },
    });
    try {
      execFileSync('pnpm', ['exec', 'prisma', 'db', 'seed'], { stdio: 'pipe' });
      execFileSync('pnpm', ['exec', 'prisma', 'db', 'seed'], { stdio: 'pipe' });
      assert.equal(
        (
          await db.prisma.permission.findUniqueOrThrow({
            where: { key: 'integrations.sync' },
          })
        ).minimumLevel,
        30,
      );
    } finally {
      await db.prisma.permission.update({
        where: { key: 'integrations.sync' },
        data: { minimumLevel: 20 },
      });
    }
    AuthService.prototype.authenticate = async (token) => {
      if (token === 'supervisor') return user;
      if (token === 'kam') return { ...user, level: 10 };
      throw new UnauthorizedException();
    };
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    assert.ok(document.paths['/api/integrations/{source}/sync']);
    assert.ok(document.components?.schemas?.SyncRunDto);
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const get = (path: string, token = 'supervisor', method = 'GET') =>
      fetch(base + path, {
        method,
        headers: { authorization: 'Bearer ' + token },
      });
    assert.equal((await get('/api/integrations', 'kam')).status, 403);
    assert.equal((await get('/api/integrations', 'invalid')).status, 401);
    assert.equal(
      (await get('/api/integrations/LMS/sync', 'kam', 'POST')).status,
      403,
    );
    const states = await (await get('/api/integrations')).json();
    assert.equal(states.length, 2);
    assert.ok(
      states.every(
        (s: { availability: string; nextRunAt: unknown }) =>
          s.availability === 'NOT_IMPLEMENTED' && s.nextRunAt === null,
      ),
    );
    for (const source of ['LMS', 'WEBSITE']) {
      const response = await get(
        '/api/integrations/' + source + '/sync',
        'supervisor',
        'POST',
      );
      assert.equal(response.status, 409);
      assert.equal((await response.json()).message, 'SOURCE_NOT_IMPLEMENTED');
    }
    assert.equal(await db.prisma.integrationSyncRun.count(), 0);
    assert.equal((await get('/api/integrations/UNKNOWN/runs')).status, 404);
    assert.equal(
      (await get('/api/integrations/LMS/runs?pageSize=101')).status,
      400,
    );
    assert.equal((await get('/api/integrations/LMS/runs?extra=1')).status, 400);
    assert.equal(
      (await get('/api/integrations/LMS/runs/not-uuid')).status,
      400,
    );
    assert.equal(
      (await get('/api/integrations/LMS/runs/' + randomUUID())).status,
      404,
    );
    assert.equal((await get('/api/ready')).status, 200);
    await app.close();
    app = undefined;
    AuthService.prototype.authenticate = originalAuth;

    const first = await service.start('LMS', user);
    await assert.rejects(
      () => service.start('LMS', user),
      /SYNC_ALREADY_ACTIVE/,
    );
    const claims = await Promise.all([
      repo.claim(first.runId),
      repo.claim(first.runId),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    const execution = claims.find((s): s is string => s !== null)!;
    assert.equal((await repo.complete(first.runId, randomUUID())).count, 0);
    assert.equal((await repo.complete(first.runId, execution)).count, 1);
    await processor.process(first.runId);
    assert.equal(calls, 0);
    assert.equal(
      (await repo.fail(first.runId, execution, 1, true, 'TEMPORARY_FAILURE'))
        .count,
      0,
    );

    const old = await service.start('LMS', user);
    const oldExecution = (await repo.claim(old.runId))!;
    await db.prisma.integrationSyncRun.update({
      where: { id: old.runId },
      data: { leaseUntil: new Date(0) },
    });
    assert.equal((await repo.heartbeat(old.runId, oldExecution)).count, 0);
    assert.equal((await repo.complete(old.runId, oldExecution)).count, 0);
    const newExecution = (await repo.claim(old.runId))!;
    assert.notEqual(newExecution, oldExecution);
    assert.equal((await repo.complete(old.runId, oldExecution)).count, 0);
    assert.equal((await repo.complete(old.runId, newExecution)).count, 1);

    mode = 'temporary';
    const retry = await service.start('LMS', user);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const before = Date.now();
      await assert.rejects(
        () => processor.process(retry.runId),
        /TEMPORARY_FAILURE/,
      );
      const current = (await repo.find(retry.runId))!;
      assert.equal(current.attempts, attempt);
      assert.equal(current.status, attempt < 3 ? 'QUEUED' : 'FAILED');
      assert.ok(current.nextAttemptAt.getTime() >= before + 60000);
      if (attempt < 3) {
        assert.equal(await repo.claim(retry.runId), null);
        await db.prisma.integrationSyncRun.update({
          where: { id: retry.runId },
          data: { nextAttemptAt: new Date(0) },
        });
      }
    }
    mode = 'invalid';
    const invalid = await service.start('LMS', user);
    await assert.rejects(
      () => processor.process(invalid.runId),
      /INVALID_DATA/,
    );
    assert.equal((await repo.find(invalid.runId))?.attempts, 1);
    assert.equal((await repo.find(invalid.runId))?.status, 'FAILED');
    mode = 'ok';
    allowed = false;
    const denied = await service.start('LMS', user);
    await assert.rejects(
      () => processor.process(denied.runId),
      /ACCESS_UNAVAILABLE/,
    );
    assert.equal((await repo.find(denied.runId))?.status, 'FAILED');
    allowed = true;
    const raised = await service.start('LMS', user);
    await db.prisma.permission.update({
      where: { key: 'integrations.sync' },
      data: { minimumLevel: 30 },
    });
    try {
      await assert.rejects(
        () => processor.process(raised.runId),
        /ACCESS_UNAVAILABLE/,
      );
    } finally {
      await db.prisma.permission.update({
        where: { key: 'integrations.sync' },
        data: { minimumLevel: 20 },
      });
    }

    const when = new Date('2026-09-29T13:47:00Z');
    await Promise.all([service.schedule(when), service.schedule(when)]);
    const scheduled = await db.prisma.integrationSyncRun.findFirstOrThrow({
      where: { status: 'QUEUED', source: 'LMS' },
    });
    assert.equal(scheduled.trigger, 'SCHEDULED');
    assert.equal(scheduled.initiatorId, null);
    await processor.process(scheduled.id);
    await service.schedule(when);
    assert.equal(
      await db.prisma.integrationSyncRun.count({
        where: { scheduledAt: new Date('2026-09-29T13:00:00Z') },
      }),
      1,
    );

    const exhausted = await service.start('LMS', user);
    await db.prisma.integrationSyncRun.update({
      where: { id: exhausted.runId },
      data: { status: 'RUNNING', attempts: 3, leaseUntil: new Date(0) },
    });
    await repo.pending();
    assert.equal(
      (await repo.find(exhausted.runId))?.errorCode,
      'RETRY_EXHAUSTED',
    );
    const history = await service.list('LMS', { page: 1, pageSize: 2 });
    assert.equal(history.rows.length, 2);
    assert.ok(history.total >= 6);
    assert.ok(!('executionId' in history.rows[0]));
    assert.ok(!('initiator' in history.rows[0]));

    outbox.onModuleInit();
    // A failed Redis dispatch leaves the durable run for the next healthy dispatcher.
    const originalRedis = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    const unavailable = new SyncQueueService(repo);
    unavailable.onModuleInit();
    const queued = await service.start('LMS', user);
    try {
      await assert.rejects(() => unavailable.dispatch());
    } finally {
      await unavailable.onModuleDestroy();
      process.env.REDIS_URL = originalRedis;
    }
    assert.equal((await repo.find(queued.runId))?.status, 'QUEUED');
    await outbox.dispatch();
    // Remove the queued delivery to represent Redis data loss, then redispatch it.
    const queuedTask = await queue.getJob('sync-' + queued.runId);
    assert.ok(queuedTask);
    await queuedTask.remove();
    await outbox.dispatch();
    assert.ok(await queue.getJob('sync-' + queued.runId));
    worker = new Worker('crm-sync', (job) => processor.process(job.data.id), {
      connection: redisConnection(),
      lockDuration: 1000,
      stalledInterval: 1000,
    });
    worker.on('error', () => console.warn('TEST_SYNC_WORKER_ERROR'));
    await until(
      async () => (await repo.find(queued.runId))?.status === 'SUCCEEDED',
    );
    const after = calls;
    await processor.process(queued.runId);
    assert.equal(calls, after);
    // Exercise failed BullMQ delivery removal, not just direct DB retry transitions.
    mode = 'temporary';
    const queueRetry = await service.start('LMS', user);
    await outbox.dispatch();
    await until(async () => {
      const run = await repo.find(queueRetry.runId);
      const task = await queue.getJob('sync-' + queueRetry.runId);
      return (
        run?.status === 'QUEUED' &&
        run.attempts === 1 &&
        (await task?.getState()) === 'failed'
      );
    });
    mode = 'ok';
    await db.prisma.integrationSyncRun.update({
      where: { id: queueRetry.runId },
      data: { nextAttemptAt: new Date(0) },
    });
    await outbox.dispatch();
    await until(
      async () => (await repo.find(queueRetry.runId))?.status === 'SUCCEEDED',
    );
    assert.equal((await repo.find(queueRetry.runId))?.attempts, 2);
    await worker.close();
    worker = undefined;

    // SIGKILL a separate process: force-close within this process still leaves its task alive.
    const interrupted = await repo.create(
      'LMS',
      null,
      new Date('2030-01-01T00:00:00Z'),
    );
    child = spawn('node', ['--import', 'tsx', 'test/fixtures/sync-worker.ts'], {
      env: { ...process.env, TEST_SYNC_HANG: '1' },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    await outbox.dispatch();
    await until(
      async () => (await repo.find(interrupted.id))?.status === 'RUNNING',
    );
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    child = undefined;
    await db.prisma.integrationSyncRun.update({
      where: { id: interrupted.id },
      data: { leaseUntil: new Date(0) },
    });
    child = spawn('node', ['--import', 'tsx', 'test/fixtures/sync-worker.ts'], {
      env: { ...process.env, TEST_SYNC_HANG: '0' },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    await until(
      async () => (await repo.find(interrupted.id))?.status === 'SUCCEEDED',
    );
    assert.equal((await repo.find(interrupted.id))?.attempts, 2);
    const finished = once(child, 'exit');
    child.kill('SIGTERM');
    await finished;
    child = undefined;

    const cleanupRun = await service.start('LMS', user);
    await terminate(cleanupRun.runId);
    await db.prisma.integrationSyncRun.update({
      where: { id: cleanupRun.runId },
      data: { completedAt: new Date(0) },
    });
    const retained = await service.start('LMS', user);
    const deleted = await repo.cleanup();
    assert.equal(deleted.count, 1);
    assert.ok(await repo.find(retained.runId));
    await terminate(retained.runId);
    assert.equal(
      await db.prisma.project.count({ where: { createdById: owner.id } }),
      0,
    );
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
    }
    AuthService.prototype.authenticate = originalAuth;
    await worker?.close();
    await app?.close();
    await outbox.onModuleDestroy();
    await queue.obliterate({ force: true });
    await queue.close();
    await db.prisma.integrationSyncRun.deleteMany();
    await db.prisma.user.delete({ where: { id: owner.id } });
    await db.onModuleDestroy();
  }
});
