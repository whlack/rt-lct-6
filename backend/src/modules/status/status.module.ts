import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { StatusController } from './controllers/status.controller.js';
import { StatusService } from './services/status.service.js';
import { MetricsController } from './controllers/metrics.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [StatusController, MetricsController],
  providers: [StatusService],
})
export class StatusModule {}
