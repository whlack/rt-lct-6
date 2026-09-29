import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { positiveInteger, redisConnection } from '../config/jobs.js';
import { syncInterval, syncRetentionDays } from '../config/sync.js';
import {
  SyncService,
  SyncProcessor,
  SyncRepository,
} from '../modules/integration-sync/index.js';
import { sources } from '../integrations/sync-adapter.js';
import { syncRunsCleaned } from '../common/metrics.js';
@Injectable()
export class SyncWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncWorkerService.name);
  private worker?: Worker;
  private timer?: ReturnType<typeof setInterval>;
  private ticking?: Promise<void>;
  private stopping = false;
  constructor(
    @Inject(SyncService) private readonly sync: SyncService,
    @Inject(SyncProcessor) private readonly processor: SyncProcessor,
    @Inject(SyncRepository) private readonly repository: SyncRepository,
  ) {}
  onModuleInit() {
    sources.forEach((source) => syncInterval(source));
    syncRetentionDays();
    this.worker = new Worker(
      'crm-sync',
      async (job) => {
        const data: unknown = job.data;
        if (
          !data ||
          typeof data !== 'object' ||
          !('id' in data) ||
          typeof data.id !== 'string'
        )
          throw new Error('INVALID_SYNC_JOB');
        await this.processor.process(data.id);
      },
      {
        connection: redisConnection(),
        concurrency: positiveInteger('SYNC_CONCURRENCY', 1),
      },
    );
    this.worker.on('error', () =>
      this.logger.warn('SYNC_WORKER_QUEUE_UNAVAILABLE'),
    );
    this.timer = setInterval(() => {
      void this.tick().catch(() => this.logger.warn('SYNC_SCHEDULE_FAILED'));
    }, 30000);
    this.timer.unref();
  }
  async healthy(): Promise<boolean> {
    if (this.stopping || !this.worker?.isRunning()) return false;
    try {
      return await Promise.race([
        this.worker.getBackend().client.then(async (client) => {
          await client.get('crm:health');
          return true;
        }),
        new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), 2000);
          timer.unref();
        }),
      ]);
    } catch {
      return false;
    }
  }
  tick(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.ticking) return this.ticking;
    this.ticking = this.maintain().finally(() => {
      this.ticking = undefined;
    });
    return this.ticking;
  }
  private async maintain() {
    await this.sync.schedule();
    const cleaned = await this.repository.cleanup();
    syncRunsCleaned.inc(cleaned.count);
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.ticking?.catch(() => this.logger.warn('SYNC_SCHEDULE_STOPPED'));
    await this.worker?.close();
  }
}
