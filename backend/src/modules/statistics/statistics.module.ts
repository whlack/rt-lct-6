import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { JobsModule } from '../jobs/index.js';
import { StatisticsController } from './controllers/statistics.controller.js';
import { StatisticsService } from './services/statistics.service.js';
import { StatisticsRepository } from './repositories/statistics.repository.js';
import { BrowserRenderer } from '../../integrations/rendering/browser.adapter.js';
@Module({
  imports: [DatabaseModule, JobsModule],
  controllers: [StatisticsController],
  providers: [StatisticsRepository, StatisticsService, BrowserRenderer],
  exports: [StatisticsService],
})
export class StatisticsModule {}
