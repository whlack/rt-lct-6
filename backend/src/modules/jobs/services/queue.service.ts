import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection } from '../../../config/jobs.js';
import { JobsRepository } from '../repositories/jobs.repository.js';
import type { QueueKind } from '../job.types.js';
import { queueLength } from '../../../common/metrics.js';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private exportQueue?: Queue;
  private importQueue?: Queue;
  get exports(): Queue {
    if (!this.exportQueue) throw new Error('Queue not initialized');
    return this.exportQueue;
  }
  get imports(): Queue {
    if (!this.importQueue) throw new Error('Queue not initialized');
    return this.importQueue;
  }
  private timer?: ReturnType<typeof setInterval>;
  private dispatching = false;
  constructor(@Inject(JobsRepository) private readonly jobs: JobsRepository) {}
  onModuleInit() {
    this.exportQueue = new Queue('crm-exports', {
      connection: {
        ...redisConnection(),
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
    });
    this.importQueue = new Queue('crm-imports', {
      connection: {
        ...redisConnection(),
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
    });
    for (const queue of [this.exports, this.imports])
      queue.on('error', () => this.logger.warn('QUEUE_UNAVAILABLE'));
    this.timer = setInterval(() => {
      void this.dispatch().catch(() => this.logger.warn('DISPATCH_FAILED'));
    }, 5000);
    this.timer.unref();
  }
  async dispatch() {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      for (const [name, queue] of [
        ['exports', this.exports],
        ['imports', this.imports],
      ] as const) {
        const lengths = await queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
        );
        for (const [state, value] of Object.entries(lengths))
          queueLength.set({ queue: name, state }, value);
      }
      for (const job of await this.jobs.pending()) {
        const queue = job.kind === 'export' ? this.exports : this.imports;
        const jobId =
          job.kind + '-' + job.id + (job.phase ? '-' + job.phase : '');
        const existing = await queue.getJob(jobId);
        if (existing) {
          const state = await existing.getState();
          if (!['completed', 'failed'].includes(state) || job.attempts >= 3)
            continue;
          await existing.remove();
        }
        await queue.add(
          job.kind,
          { id: job.id, phase: job.phase },
          {
            jobId,
            attempts: 3,
            backoff: { type: 'exponential', delay: 10000 },
            removeOnComplete: { age: 86400 },
            removeOnFail: { age: 86400 },
          },
        );
      }
    } finally {
      this.dispatching = false;
    }
  }
  async notify(kind: QueueKind, id: string, phase = '') {
    const queue = kind === 'export' ? this.exports : this.imports;
    try {
      await queue.add(
        kind,
        { id, phase },
        {
          jobId: kind + '-' + id + (phase ? '-' + phase : ''),
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 86400 },
        },
      );
    } catch {
      this.logger.warn('JOB_PENDING_DELIVERY');
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await Promise.all([this.exportQueue?.close(), this.importQueue?.close()]);
  }
}
