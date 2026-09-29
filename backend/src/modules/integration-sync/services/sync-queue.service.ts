import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection } from '../../../config/jobs.js';
import { queueLength } from '../../../common/metrics.js';
import { SyncRepository } from '../repositories/sync.repository.js';
@Injectable()
export class SyncQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncQueueService.name);
  private queue?: Queue;
  private timer?: ReturnType<typeof setInterval>;
  private dispatching?: Promise<void>;
  private stopping = false;
  constructor(
    @Inject(SyncRepository) private readonly repository: SyncRepository,
  ) {}
  private createQueue() {
    this.queue = new Queue('crm-sync', {
      connection: {
        ...redisConnection(),
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 1000,
        // BullMQ waits for initial readiness; finite connection retries avoid hanging dispatch/shutdown.
        retryStrategy: (attempt: number) =>
          attempt <= 2 ? attempt * 250 : null,
      },
    });
    this.queue.on('error', () => this.logger.warn('SYNC_QUEUE_UNAVAILABLE'));
  }
  onModuleInit() {
    this.createQueue();
    this.timer = setInterval(() => {
      void this.dispatch().catch(() =>
        this.logger.warn('SYNC_DISPATCH_FAILED'),
      );
    }, 5000);
    this.timer.unref();
  }
  dispatch(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.dispatching) return this.dispatching;
    this.dispatching = this.deliver()
      .catch(async (error) => {
        await this.queue?.close();
        this.queue = undefined;
        throw error;
      })
      .finally(() => {
        this.dispatching = undefined;
      });
    return this.dispatching;
  }
  private async deliver() {
    if (!this.queue) this.createQueue();
    const queue = this.queue!;
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
    );
    for (const [state, value] of Object.entries(counts))
      queueLength.set({ queue: 'sync', state }, value);
    for (const run of await this.repository.pending()) {
      const jobId = 'sync-' + run.id;
      const existing = await queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state !== 'failed' && state !== 'completed') continue;
        await existing.remove();
      }
      // DB owns retry timing/attempts; each queue delivery represents one attempt.
      // Retrying a failed delivery under the same stable ID restores Redis loss safely.
      await queue.add(
        'sync',
        { id: run.id },
        {
          jobId,
          attempts: 1,
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 86400 },
        },
      );
      await this.repository.delivered(run.id);
    }
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.dispatching?.catch(() =>
      this.logger.warn('SYNC_DISPATCH_STOPPED'),
    );
    await this.queue?.close();
  }
}
