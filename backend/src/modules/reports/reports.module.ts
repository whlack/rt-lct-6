import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { ReportsController } from './controllers/reports.controller.js';
import { ReportRepository } from './repositories/report.repository.js';
import { ReportService } from './services/report.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ReportsController],
  providers: [ReportRepository, ReportService],
  exports: [ReportRepository, ReportService],
})
export class ReportsModule {}
