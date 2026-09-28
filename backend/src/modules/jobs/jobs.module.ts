import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/index.js';
import { JobsRepository } from './repositories/jobs.repository.js';
import { QueueService } from './services/queue.service.js';
import { JobsService } from './services/jobs.service.js';
import { BackgroundIdentityService } from './services/background-identity.service.js';
import { JobsController } from './controllers/jobs.controller.js';
import { S3Adapter } from '../../integrations/storage/s3.adapter.js';
import { CleanupService } from './services/cleanup.service.js';
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [JobsController],
  providers: [
    JobsRepository,
    QueueService,
    JobsService,
    BackgroundIdentityService,
    S3Adapter,
    CleanupService,
  ],
  exports: [
    JobsRepository,
    QueueService,
    JobsService,
    BackgroundIdentityService,
    S3Adapter,
    CleanupService,
  ],
})
export class JobsModule {}
