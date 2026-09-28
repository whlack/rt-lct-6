import { Module } from '@nestjs/common';
import { JobsModule } from '../modules/jobs/index.js';
import { ReportsModule } from '../modules/reports/index.js';
import { WorkerService } from './worker.service.js';
import { DatabaseModule } from '../database/database.module.js';
@Module({
  imports: [DatabaseModule, JobsModule, ReportsModule],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
