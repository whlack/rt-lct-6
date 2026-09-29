import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { PermissionsController } from './controllers/permissions.controller.js';
import { PermissionRepository } from './repositories/permission.repository.js';
import { PermissionService } from './services/permission.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PermissionsController],
  providers: [PermissionRepository, PermissionService],
  exports: [PermissionService],
})
export class PermissionsModule {}
