import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { employeeSchema } from '../dto/auth-response.schema.js';
import { array } from '../../../common/api-schema.js';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { Controller, Get, Inject } from '@nestjs/common';
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
  @ApiOkResponse({ schema: array(employeeSchema) })
  @ApiOperation({
    summary: 'Список КАМ',
    description:
      'Право: projects.create или universities.assignees.manage. Чтение сотрудников Keycloak сервисным клиентом. Локальное переопределение имени имеет приоритет. Достаточно одного права: projects.create или universities.assignees.manage.',
    operationId: 'auth_employees_list',
  })
  @ApiErrors({
    ...authenticationErrors,
    503: 'Сервисный каталог Keycloak временно недоступен.',
  })
  @RequireAnyPermission('projects.create', 'universities.assignees.manage')
  async list() {
    return this.users.employees(await this.directory.listKam());
  }

  @Get('managers')
  @ApiOkResponse({ schema: array(employeeSchema) })
  @ApiOperation({
    summary: 'Список руководителей и администраторов',
    description:
      'Право: projects.assignees.manage. Сотрудники Keycloak, которых можно назначить руководителем проекта; локальное переопределение имени имеет приоритет.',
    operationId: 'auth_employees_managers',
  })
  @ApiErrors({
    ...authenticationErrors,
    503: 'Сервисный каталог Keycloak временно недоступен.',
  })
  @RequireAnyPermission('projects.assignees.manage')
  async managers() {
    return this.users.employees(await this.directory.listManagers());
  }
}
