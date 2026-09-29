import { CommonModule } from '../../common/common.module.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/index.js';
import { UniversitiesModule } from '../universities/index.js';
import { ProjectsController } from './controllers/projects.controller.js';
import { ProjectRepository } from './repositories/project.repository.js';
import { ProjectService } from './services/project.service.js';
import { ProjectFileService } from './services/project-file.service.js';
import { S3Adapter } from '../../integrations/storage/s3.adapter.js';

@Module({
  imports: [CommonModule, DatabaseModule, AuthModule, UniversitiesModule],
  controllers: [ProjectsController],
  providers: [ProjectRepository, ProjectService, ProjectFileService, S3Adapter],
  exports: [ProjectService, ProjectRepository],
})
export class ProjectsModule {}
