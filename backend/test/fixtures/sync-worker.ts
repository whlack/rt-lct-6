// Test-only process: never imported by the application or production adapter registry.
import 'reflect-metadata';
import { Worker } from 'bullmq';
import { DatabaseService } from '../../src/database/database.service.js';
import { SyncRepository } from '../../src/modules/integration-sync/repositories/sync.repository.js';
import { SyncRegistry } from '../../src/modules/integration-sync/services/sync-registry.service.js';
import { SyncProcessor } from '../../src/modules/integration-sync/services/sync-processor.service.js';
import { WebsiteAdapter } from '../../src/integrations/website/website.adapter.js';
import type { SyncAdapter } from '../../src/integrations/sync-adapter.js';
import { redisConnection } from '../../src/config/jobs.js';
const database = new DatabaseService();
const adapter: SyncAdapter = {
  source: 'LMS',
  availability: 'READY',
  execute: async ({ signal }) => {
    if (process.env.TEST_SYNC_HANG === '1')
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new Error('LEASE_LOST')),
          { once: true },
        );
      });
  },
};
const processor = new SyncProcessor(
  new SyncRepository(database),
  new SyncRegistry([adapter, new WebsiteAdapter()]),
  {
    resolve: async () => {
      throw new Error('This fixture only processes scheduled jobs');
    },
  },
);
const worker = new Worker('crm-sync', (job) => processor.process(job.data.id), {
  connection: redisConnection(),
  lockDuration: 1000,
  stalledInterval: 1000,
});
worker.on('error', () => console.warn('TEST_SYNC_WORKER_ERROR'));
process.on('SIGTERM', () => {
  void worker.close().then(() => database.onModuleDestroy());
});
