import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { KeycloakDirectoryAdapter } from '../../../integrations/keycloak/directory.adapter.js';
import { RequireAnyPermission } from '../decorators/permissions.decorator.js';
import { UserRepository } from '../repositories/user.repository.js';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('api/employees')
export class EmployeesController {
  constructor(
    @Inject(KeycloakDirectoryAdapter)
    private readonly directory: KeycloakDirectoryAdapter,
    @Inject(UserRepository) private readonly users: UserRepository,
  ) {}

  @Get()
  @RequireAnyPermission('projects.create', 'universities.assignees.manage')
  async list() {
    return this.users.employees(await this.directory.listKam());
  }

  @Get('managers')
  @RequireAnyPermission('projects.assignees.manage')
  async managers() {
    return this.users.employees(await this.directory.listManagers());
  }
}
