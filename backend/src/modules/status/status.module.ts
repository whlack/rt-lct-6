import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { StatusController } from './controllers/status.controller.js';
import { StatusService } from './services/status.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [StatusController],
  providers: [StatusService],
})
export class StatusModule {}
