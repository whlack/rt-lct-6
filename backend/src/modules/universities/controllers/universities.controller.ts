import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import {
  universityCard,
  universityContacts,
  universityContact,
  universityList,
  universityRecord,
  universityAssignments,
} from '../dto/university-response.schema.js';
import { UuidParam, ValidatedBody } from '../../../common/validated-input.js';
import {
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import {
  AssigneeDto,
  ContactDto,
  PrimaryContactDto,
  UniversityDto,
} from '../dto/university.dto.js';
import { UniversityService } from '../services/university.service.js';

@ApiTags('universities')
@ApiBearerAuth()
@Controller('api/universities')
export class UniversitiesController {
  constructor(
    @Inject(UniversityService) private readonly universities: UniversityService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Список доступных вузов',
    description:
      'Право: universities.read. Возвращает массив кратких проекций без пагинации. Политика видимости КАМ применяется на сервере.',
    operationId: 'universities_list',
  })
  @ApiErrors({ ...authenticationErrors })
  @RequirePermission('universities.read')
  @ApiOkResponse({ schema: universityList })
  list(@Req() request: AuthRequest) {
    return this.universities.list(currentUser(request));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Карточка вуза',
    description:
      'Право: universities.read. Сведения вуза и локальные ID назначенных сотрудников.',
    operationId: 'universities_get',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('universities.read')
  @ApiOkResponse({ schema: universityCard })
  get(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.universities.get(currentUser(request), id);
  }

  @Post()
  @ApiOperation({
    summary: 'Создать вуз',
    description:
      'Право: universities.create. Название нормализуется для уникальности; автор автоматически назначается сотрудником вуза.',
    operationId: 'universities_create',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('universities.create')
  @ApiCreatedResponse({ schema: universityRecord })
  create(
    @Req() request: AuthRequest,
    @ValidatedBody(UniversityDto) body: UniversityDto,
  ) {
    return this.universities.create(currentUser(request), body.name);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Изменить название вуза',
    description:
      'Право: universities.update. Уникальность без учёта регистра и повторных пробелов проверяет PostgreSQL.',
    operationId: 'universities_update',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('universities.update')
  @ApiOkResponse({ schema: universityRecord })
  update(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(UniversityDto) body: UniversityDto,
  ) {
    return this.universities.update(currentUser(request), id, body.name);
  }

  @Get(':id/contacts')
  @ApiOperation({
    summary: 'Контакты вуза',
    description:
      'Право: university_contacts.read. Массив контактных лиц доступного вуза.',
    operationId: 'universities_listContacts',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('university_contacts.read')
  @ApiOkResponse({ schema: universityContacts })
  listContacts(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.universities.listContacts(currentUser(request), id);
  }

  @Post(':id/contacts')
  @ApiOperation({
    summary: 'Добавить контакт вуза',
    description:
      'Право: university_contacts.create. Обязательны имя и хотя бы email либо phone. Контакт вуза не является учётной записью Keycloak.',
    operationId: 'universities_createContact',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('university_contacts.create')
  @ApiCreatedResponse({ schema: universityContact })
  createContact(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(ContactDto) body: ContactDto,
  ) {
    return this.universities.createContact(currentUser(request), id, body);
  }

  @Patch(':id/contacts/:contactId')
  @ApiOperation({
    summary: 'Изменить контакт вуза',
    description:
      'Право: university_contacts.update. Передаётся имя и хотя бы email либо phone; null очищает необязательное контактное поле.',
    operationId: 'universities_updateContact',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('university_contacts.update')
  @ApiOkResponse({ schema: universityContact })
  updateContact(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('contactId') contactId: string,
    @ValidatedBody(ContactDto) body: ContactDto,
  ) {
    return this.universities.updateContact(
      currentUser(request),
      id,
      contactId,
      body,
    );
  }

  @Patch(':id/primary-contact')
  @ApiOperation({
    summary: 'Выбрать основной контакт',
    description:
      'Право: university_contacts.update. Контакт должен принадлежать этому вузу.',
    operationId: 'universities_setPrimaryContact',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('university_contacts.update')
  @ApiOkResponse({ schema: universityRecord })
  setPrimaryContact(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(PrimaryContactDto) body: PrimaryContactDto,
  ) {
    return this.universities.setPrimaryContact(
      currentUser(request),
      id,
      body.contactId,
    );
  }

  @Get(':id/assignees')
  @ApiOperation({
    summary: 'Назначенные сотрудники вуза',
    description:
      'Право: universities.read. Локальные ID и Keycloak subject; полный профиль не возвращается.',
    operationId: 'universities_listAssignments',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('universities.read')
  @ApiOkResponse({ schema: universityAssignments })
  listAssignments(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.universities.listAssignments(currentUser(request), id);
  }

  @Post(':id/assignees')
  @ApiOperation({
    summary: 'Назначить КАМ на вуз',
    description:
      'Право: universities.assignees.manage. Уровень не ниже 20. subject должен соответствовать существующему КАМ Keycloak. Возвращается обновлённый список назначений.',
    operationId: 'universities_assign',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    503: 'Сервисный каталог Keycloak временно недоступен.',
  })
  @RequirePermission('universities.assignees.manage')
  @ApiCreatedResponse({ schema: universityAssignments })
  assign(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(AssigneeDto) body: AssigneeDto,
  ) {
    return this.universities.assign(currentUser(request), id, body.subject);
  }

  @Delete(':id/assignees/:subject')
  @ApiOperation({
    summary: 'Снять назначение КАМ',
    description:
      'Право: universities.assignees.manage. Уровень не ниже 20. Возвращается обновлённый список; отсутствующее назначение — 404.',
    operationId: 'universities_unassign',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('universities.assignees.manage')
  @ApiOkResponse({ schema: universityAssignments })
  unassign(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('subject') subject: string,
  ) {
    return this.universities.unassign(currentUser(request), id, subject);
  }
}
