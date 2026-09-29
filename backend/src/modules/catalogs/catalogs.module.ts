import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { CatalogController } from './controllers/catalog.controller.js';
import { CatalogRepository } from './repositories/catalog.repository.js';
import { CatalogService } from './services/catalog.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController],
  providers: [CatalogRepository, CatalogService],
})
export class CatalogsModule {}
