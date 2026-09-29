import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/index.js';
import { JobsModule } from '../jobs/index.js';
import { LmsAdapter } from '../../integrations/lms/lms.adapter.js';
import { WebsiteAdapter } from '../../integrations/website/website.adapter.js';
import { SYNC_ADAPTERS } from '../../integrations/sync-adapter.js';
import { SyncController } from './controllers/sync.controller.js';
import { SyncRegistry } from './services/sync-registry.service.js';
import { SyncRepository } from './repositories/sync.repository.js';
import { SyncService } from './services/sync.service.js';
import { SyncQueueService } from './services/sync-queue.service.js';
import { SyncProcessor } from './services/sync-processor.service.js';
@Module({
  imports: [DatabaseModule, AuthModule, JobsModule],
  controllers: [SyncController],
  providers: [
    LmsAdapter,
    WebsiteAdapter,
    {
      provide: SYNC_ADAPTERS,
      useFactory: (lms: LmsAdapter, website: WebsiteAdapter) => [lms, website],
      inject: [LmsAdapter, WebsiteAdapter],
    },
    SyncRegistry,
    SyncRepository,
    SyncService,
    SyncQueueService,
    SyncProcessor,
  ],
  exports: [SyncService, SyncQueueService, SyncProcessor, SyncRepository],
})
export class IntegrationSyncModule {}
