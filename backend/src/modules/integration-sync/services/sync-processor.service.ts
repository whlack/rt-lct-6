import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { SyncRepository } from '../repositories/sync.repository.js';
import { SyncRegistry } from './sync-registry.service.js';
import { BackgroundIdentityService } from '../../jobs/index.js';
import { SyncFailure } from '../../../integrations/sync-adapter.js';
import {
  errors,
  jobDuration,
  jobWait,
  retries,
} from '../../../common/metrics.js';
@Injectable()
export class SyncProcessor {
  private readonly logger = new Logger(SyncProcessor.name);
  constructor(
    @Inject(SyncRepository) private readonly repository: SyncRepository,
    @Inject(SyncRegistry) private readonly registry: SyncRegistry,
    @Inject(BackgroundIdentityService)
    private readonly identities: Pick<BackgroundIdentityService, 'resolve'>,
  ) {}
  async process(id: string): Promise<void> {
    const executionId = await this.repository.claim(id);
    if (!executionId) {
      const run = await this.repository.find(id);
      if (!run || run.status === 'SUCCEEDED' || run.status === 'FAILED') return;
      throw new Error('SYNC_LEASE_BUSY');
    }
    const started = performance.now();
    const abort = new AbortController();
    let outcome = 'LEASE_LOST';
    let beating = false;
    let pendingHeartbeat: Promise<void> | undefined;
    const heartbeat = setInterval(() => {
      if (beating || abort.signal.aborted) return;
      beating = true;
      pendingHeartbeat = this.repository
        .heartbeat(id, executionId)
        .then((result) => {
          if (!result.count) abort.abort();
        })
        .catch(() => {
          abort.abort();
          this.logger.warn({ jobId: id, result: 'SYNC_HEARTBEAT_FAILED' });
        })
        .finally(() => {
          beating = false;
        });
    }, 5000);
    heartbeat.unref();
    let attempts = 3;
    let source = 'UNKNOWN';
    try {
      const run = await this.repository.find(id);
      if (!run || run.executionId !== executionId) return;
      source = run.source;
      attempts = run.attempts;
      const kind = 'sync_' + run.source.toLowerCase();
      jobWait.observe(
        { kind },
        Math.max(0, Date.now() - run.createdAt.getTime()) / 1000,
      );
      if (attempts > 1) retries.inc({ kind });
      const adapter = this.registry.get(run.source);
      if (adapter.availability !== 'READY')
        throw new SyncFailure('SOURCE_NOT_IMPLEMENTED');
      if (run.trigger === 'MANUAL') {
        if (!run.initiator) throw new SyncFailure('ACCESS_UNAVAILABLE');
        await this.identities.resolve(
          run.initiator.keycloakSubject,
          'integrations.sync',
        );
      }
      abort.signal.throwIfAborted();
      await adapter.execute({ runId: id, signal: abort.signal });
      abort.signal.throwIfAborted();
      const result = await this.repository.complete(id, executionId);
      outcome = result.count ? 'SUCCEEDED' : 'LEASE_LOST';
      this.logger.log({ jobId: id, source, result: outcome });
    } catch (error) {
      if (abort.signal.aborted) throw new Error('SYNC_LEASE_LOST');
      const failure =
        error instanceof SyncFailure
          ? error
          : error instanceof HttpException && error.getStatus() < 500
            ? new SyncFailure(
                error.getStatus() === 400
                  ? 'INVALID_DATA'
                  : 'ACCESS_UNAVAILABLE',
              )
            : new SyncFailure('TEMPORARY_FAILURE', true);
      outcome = failure.code;
      const result = await this.repository.fail(
        id,
        executionId,
        attempts,
        failure.retryable,
        failure.code,
        Number.isSafeInteger(failure.retryAfterMs) && failure.retryAfterMs > 0
          ? failure.retryAfterMs
          : 0,
      );
      if (result.count)
        errors.inc({
          kind: 'sync_' + source.toLowerCase(),
          code: failure.code,
        });
      this.logger.warn({
        jobId: id,
        source,
        result: result.count ? failure.code : 'LEASE_LOST',
      });
      // Queue failure is final for this delivery; DB outbox alone schedules the retry.
      throw new Error(failure.code);
    } finally {
      clearInterval(heartbeat);
      await pendingHeartbeat;
      jobDuration.observe(
        { kind: 'sync_' + source.toLowerCase(), result: outcome },
        (performance.now() - started) / 1000,
      );
    }
  }
}
