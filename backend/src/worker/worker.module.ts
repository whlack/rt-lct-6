import { Module } from '@nestjs/common';
import { JobsModule } from '../modules/jobs/index.js';
import { ReportsModule } from '../modules/reports/index.js';
import { WorkerService } from './worker.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { CatalogImportModule } from '../modules/catalog-import/index.js';
import { StatisticsModule } from '../modules/statistics/index.js';
@Module({
  imports: [
    DatabaseModule,
    JobsModule,
    ReportsModule,
    CatalogImportModule,
    StatisticsModule,
  ],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class WorkerModule {}
