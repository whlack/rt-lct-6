import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/index.js';
import { UniversitiesController } from './controllers/universities.controller.js';
import { UniversityRepository } from './repositories/university.repository.js';
import { UniversityService } from './services/university.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [UniversitiesController],
  providers: [UniversityRepository, UniversityService],
  exports: [UniversityService],
})
export class UniversitiesModule {}
