import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LmsAdapter } from '../../../integrations/lms/lms.adapter.js';
import { WebsiteAdapter } from '../../../integrations/website/website.adapter.js';
import {
  SyncFailure,
  type SyncAdapter,
} from '../../../integrations/sync-adapter.js';
import { SyncRegistry } from './sync-registry.service.js';
import { SyncService, syncSlot } from './sync.service.js';
import { SyncRepository } from '../repositories/sync.repository.js';
import { SyncPageDto } from '../dto/sync.dto.js';

test('unimplemented sources never enqueue, schedule or touch project data', async () => {
  const registry = new SyncRegistry([new LmsAdapter(), new WebsiteAdapter()]);
  // Test double exposes only allowed reads; any attempted write fails the test.
  const repository = {
    latest: async () => null,
    create: async () => {
      throw new Error('Unexpected write');
    },
  } as unknown as SyncRepository;
  const service = new SyncService(registry, repository);
  const states = await service.states();
  assert.deepEqual(
    states.map((s) => [
      s.source,
      s.availability,
      s.reason,
      s.nextRunAt,
      s.lastRun,
    ]),
    [
      ['LMS', 'NOT_IMPLEMENTED', 'SOURCE_NOT_IMPLEMENTED', null, null],
      ['WEBSITE', 'NOT_IMPLEMENTED', 'SOURCE_NOT_IMPLEMENTED', null, null],
    ],
  );
  for (const adapter of registry.all()) {
    await assert.rejects(
      () =>
        service.start(adapter.source, {
          id: 'unused',
          subject: 'unused',
          level: 20,
        }),
      (error) =>
        error instanceof ConflictException &&
        error.message === 'SOURCE_NOT_IMPLEMENTED',
    );
    await assert.rejects(
      () =>
        adapter.execute({
          runId: 'unused',
          signal: new AbortController().signal,
        }),
      (error) =>
        error instanceof SyncFailure &&
        !error.retryable &&
        error.code === 'SOURCE_NOT_IMPLEMENTED',
    );
  }
  await service.schedule();
  assert.throws(() => registry.get('OTHER'), NotFoundException);
});

test('registry requires one adapter per source and scheduler uses only current slot', async () => {
  assert.throws(() => new SyncRegistry([new LmsAdapter(), new LmsAdapter()]));
  const calls: Date[] = [];
  const adapter: SyncAdapter = {
    source: 'LMS',
    availability: 'READY',
    execute: async () => {},
  };
  const repository = {
    create: async (_source: string, _initiator: null, scheduledAt: Date) => {
      calls.push(scheduledAt);
    },
  } as unknown as SyncRepository;
  const service = new SyncService(
    new SyncRegistry([adapter, new WebsiteAdapter()]),
    repository,
  );
  await service.schedule(new Date('2026-09-29T12:47:00Z'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].toISOString(), '2026-09-29T12:00:00.000Z');
  assert.equal(
    syncSlot(new Date('2026-09-29T12:47:00Z'), 3600).toISOString(),
    calls[0].toISOString(),
  );
});

test('pagination accepts defaults and rejects nonintegers, out of bounds and unsafe offsets', async () => {
  assert.equal((await validate(new SyncPageDto())).length, 0);
  for (const input of [
    { page: 0 },
    { pageSize: 101 },
    { page: 1.5 },
    { page: 'invalid' },
    { page: 1000001 },
  ])
    assert.ok((await validate(plainToInstance(SyncPageDto, input))).length > 0);
  const valid = plainToInstance(SyncPageDto, { page: '2', pageSize: '100' });
  assert.equal((await validate(valid)).length, 0);
  assert.equal(valid.page, 2);
});
