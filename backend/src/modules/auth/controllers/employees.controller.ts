import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { KeycloakDirectoryAdapter } from '../../../integrations/keycloak/directory.adapter.js';
import { RequireAnyPermission } from '../decorators/permissions.decorator.js';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('api/employees')
export class EmployeesController {
  constructor(
    @Inject(KeycloakDirectoryAdapter)
    private readonly directory: KeycloakDirectoryAdapter,
  ) {}

  @Get()
  @RequireAnyPermission('projects.create', 'universities.assignees.manage')
  list() {
    return this.directory.listKam();
  }

  @Get('managers')
  @RequireAnyPermission('projects.assignees.manage')
  managers() {
    return this.directory.listManagers();
  }
}
