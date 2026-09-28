import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { ReportsController } from './controllers/reports.controller.js';
import { ReportRepository } from './repositories/report.repository.js';
import { ReportService } from './services/report.service.js';
import { JobsModule } from '../jobs/index.js';
import { BrowserRenderer } from '../../integrations/rendering/browser.adapter.js';
import { ReportExportsController } from './controllers/report-exports.controller.js';
import { ReportExportService } from './services/report-export.service.js';
import { ReportExportProcessor } from './services/report-export.processor.js';

@Module({
  imports: [DatabaseModule, JobsModule],
  controllers: [ReportsController, ReportExportsController],
  providers: [
    ReportRepository,
    ReportService,
    ReportExportService,
    ReportExportProcessor,
    BrowserRenderer,
  ],
  exports: [ReportRepository, ReportService, ReportExportProcessor],
})
export class ReportsModule {}
