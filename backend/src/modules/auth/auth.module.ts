import { VisibilityController } from './controllers/visibility.controller.js';
import { VisibilityService } from './services/visibility.service.js';
import { VisibilityRepository } from './repositories/visibility.repository.js';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../../database/database.module.js';
import { KeycloakTokenAdapter } from '../../integrations/keycloak/token.adapter.js';
import { KeycloakDirectoryAdapter } from '../../integrations/keycloak/directory.adapter.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { MeController } from './controllers/me.controller.js';
import { EmployeesController } from './controllers/employees.controller.js';
import { AuthGuard } from './guards/auth.guard.js';
import { UserRepository } from './repositories/user.repository.js';
import { AuthService } from './services/auth.service.js';

@Module({
  imports: [DatabaseModule, PermissionsModule],
  controllers: [MeController, EmployeesController, VisibilityController],
  providers: [
    KeycloakTokenAdapter,
    KeycloakDirectoryAdapter,
    UserRepository,
    AuthService,
    VisibilityService,
    VisibilityRepository,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [
    AuthService,
    UserRepository,
    KeycloakDirectoryAdapter,
    PermissionsModule,
  ],
})
export class AuthModule {}
