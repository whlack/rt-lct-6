import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DashboardRepository } from './repositories/dashboard.repository.js';
import { DashboardService } from './services/dashboard.service.js';
@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService],
})
export class DashboardModule {}
