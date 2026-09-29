import { CommonModule } from '../../common/common.module.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { JobsModule } from '../jobs/index.js';
import { AuthModule } from '../auth/index.js';
import { ImportRepository } from './repositories/import.repository.js';
import { ImportService } from './services/import.service.js';
import { ImportProcessor } from './services/import.processor.js';
import { ImportController } from './controllers/import.controller.js';
@Module({
  imports: [CommonModule, DatabaseModule, JobsModule, AuthModule],
  controllers: [ImportController],
  providers: [ImportRepository, ImportService, ImportProcessor],
  exports: [ImportProcessor],
})
export class CatalogImportModule {}
