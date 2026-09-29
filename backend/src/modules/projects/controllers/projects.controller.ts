import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { attachmentDisposition } from '../../../common/attachment-disposition.js';
import {
  projectActivity,
  projectCard,
  projectComment,
  projectComments,
  projectFile,
  projectHistory,
  projectPage,
  projectRecord,
} from '../dto/project-response.schema.js';
import { UploadLimitInterceptor } from '../../../common/upload-limit.interceptor.js';
import { ProjectQueryDto } from '../dto/project.dto.js';
import {
  UuidParam,
  ValidatedBody,
  ValidatedQuery,
} from '../../../common/validated-input.js';
import {
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import {
  AdvanceStageDto,
  AssignProjectDto,
  CommentBodyDto,
  CommentDto,
  ConfigureWorkflowDto,
  CreateProjectDto,
  UpdateProjectDto,
} from '../dto/project.dto.js';
import { ProjectService } from '../services/project.service.js';
import { ProjectFileService } from '../services/project-file.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('api/projects')
export class ProjectsController {
  constructor(
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectFileService) private readonly files: ProjectFileService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Список доступных проектов',
    description:
      'Право: projects.read. Постраничный реестр с текущими данными. Фильтры universityId, directionId, programId/productId, responsibleSubject, status и поиск search. actionRequired=true выбирает открытые проекты с ожиданием KAM на текущем этапе независимо от назначения текущего пользователя. Сортировка: createdAt по убыванию, id по возрастанию. В текущем реестре оба фильтра технически допускаются вместе и применяются как AND; для отчётов они взаимоисключающие.',
    operationId: 'projects_list',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
  })
  @RequirePermission('projects.read')
  @ApiOkResponse({ schema: projectPage })
  list(
    @Req() request: AuthRequest,
    @ValidatedQuery(ProjectQueryDto) query: ProjectQueryDto,
  ) {
    return this.projects.list(currentUser(request), query);
  }

  @Get('activity')
  @ApiErrors({ ...authenticationErrors })
  @RequirePermission('projects.read')
  @ApiOperation({
    summary: 'Последние события видимых проектов',
    operationId: 'projects_activity',
    description:
      'Право: projects.read. До 25 последних событий; область видимости пользователя проверяется сервером.',
  })
  @ApiOkResponse({ schema: projectActivity })
  activity(@Req() request: AuthRequest) {
    return this.projects.activity(currentUser(request));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Карточка проекта',
    description:
      'Право: projects.read. Текущие поля, участники, этапы и метаданные документов. Ключи S3 не выдаются.',
    operationId: 'projects_get',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('projects.read')
  @ApiOkResponse({ schema: projectCard })
  get(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.projects.getCard(currentUser(request), id);
  }

  @Post()
  @ApiOperation({
    summary: 'Создать проект',
    description:
      'Право: projects.create. Выберите ровно одну программу или продукт и существующего КАМ из Keycloak. Вуз должен быть доступен. Создаётся стандартный workflow; начальный этап неизменяемый.',
    operationId: 'projects_create',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    503: 'Сервисный каталог Keycloak временно недоступен.',
  })
  @RequirePermission('projects.create')
  @ApiCreatedResponse({ schema: projectRecord })
  create(
    @Req() request: AuthRequest,
    @ValidatedBody(CreateProjectDto, {
      examples: {
        program: {
          summary: 'Проект с программой',
          value: {
            universityId: '22222222-2222-4222-8222-222222222222',
            directionId: '33333333-3333-4333-8333-333333333333',
            programId: '44444444-4444-4444-8444-444444444444',
            responsibleSubject: '66666666-6666-4666-8666-666666666666',
          },
        },
        product: {
          summary: 'Проект с продуктом',
          value: {
            universityId: '22222222-2222-4222-8222-222222222222',
            directionId: '33333333-3333-4333-8333-333333333333',
            productId: '55555555-5555-4555-8555-555555555555',
            responsibleSubject: '66666666-6666-4666-8666-666666666666',
          },
        },
      },
    })
    body: CreateProjectDto,
  ) {
    return this.projects.create(currentUser(request), body);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Изменить сведения проекта',
    description:
      'Право: projects.update. Меняет необязательные коммерческие поля открытого проекта. Пропущенное поле сохраняется, null очищает nullable-поле.',
    operationId: 'projects_update',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('projects.update')
  @ApiOkResponse({ schema: projectRecord })
  update(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(UpdateProjectDto, {
      examples: {
        change: {
          summary: 'Изменить договор',
          value: {
            contractNumber: 'TEST-2026-01',
            transferStatus: 'IN_PROGRESS',
          },
        },
        clear: {
          summary: 'Очистить необязательные сведения',
          value: {
            vendor: null,
            contractNumber: null,
            licenseSignedAt: null,
            licenseExpiresYear: null,
          },
        },
      },
    })
    body: UpdateProjectDto,
  ) {
    return this.projects.update(currentUser(request), id, body);
  }

  @Patch(':id/responsible')
  @ApiOperation({
    summary: 'Назначить ответственного КАМ',
    description:
      'Право: projects.assignees.manage. Дополнительно требуется уровень не ниже 20. subject — идентификатор существующего активного КАМ в Keycloak, не локальный User.id.',
    operationId: 'projects_assign',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
    503: 'Сервисный каталог Keycloak временно недоступен.',
  })
  @RequirePermission('projects.assignees.manage')
  @ApiOkResponse({ schema: projectRecord })
  assign(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(AssignProjectDto) body: AssignProjectDto,
  ) {
    return this.projects.assignResponsible(
      currentUser(request),
      id,
      body.subject,
    );
  }

  @Patch(':id/supervisor')
  @ApiOperation({
    summary: 'Назначить руководителя проекта',
    description:
      'Право: projects.assignees.manage. Дополнительно требуется уровень не ниже 20. Выбирается существующий руководитель или администратор из Keycloak.',
    operationId: 'projects_assignSupervisor',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
    503: 'Сервисный каталог Keycloak временно недоступен.',
  })
  @RequirePermission('projects.assignees.manage')
  @ApiOkResponse({ schema: projectRecord })
  assignSupervisor(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(AssignProjectDto) body: AssignProjectDto,
  ) {
    return this.projects.assignSupervisor(
      currentUser(request),
      id,
      body.subject,
    );
  }

  @Patch(':id/workflow')
  @ApiOperation({
    summary: 'Заменить последующие этапы',
    description:
      'Право: projects.workflow.configure. Уровень не ниже 20. Начальный этап «Формирование проекта» сохраняется автоматически: в stages передаются только последующие этапы. Настройка доступна до первого перехода и запрещена при файлах на заменяемых этапах. Для UNIVERSITY обязателен контакт этого вуза; для KAM контакт запрещён.',
    operationId: 'projects_configure',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('projects.workflow.configure')
  @ApiOkResponse({ schema: projectCard })
  configure(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(ConfigureWorkflowDto, {
      examples: {
        kam: {
          summary: 'Последующие этапы без начального этапа',
          value: {
            stages: [
              {
                title: 'Согласование',
                expectedActor: 'KAM',
                documentTypes: [{ name: 'Договор', isRequired: true }],
              },
            ],
          },
        },
      },
    })
    body: ConfigureWorkflowDto,
  ) {
    return this.projects.configureWorkflow(currentUser(request), id, body);
  }

  @Post(':id/advance')
  @ApiOperation({
    summary: 'Перейти к следующему этапу',
    description:
      'Право: projects.stage.advance. expectedStageId должен совпадать с текущим этапом. Все обязательные типы документов должны иметь прикреплённый файл. После первого перехода workflow блокируется. На последнем этапе используйте close.',
    operationId: 'projects_advance',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('projects.stage.advance')
  @ApiCreatedResponse({ schema: projectRecord })
  advance(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(AdvanceStageDto) body: AdvanceStageDto,
  ) {
    return this.projects.advance(currentUser(request), id, body);
  }

  @Post(':id/close')
  @ApiOperation({
    summary: 'Закрыть проект',
    description:
      'Право: projects.close. Уровень не ниже 20, последний этап достигнут и все обязательные документы прикреплены. closedAt фиксируется сервером; закрытый проект нельзя изменять.',
    operationId: 'projects_close',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('projects.close')
  @ApiCreatedResponse({ schema: projectRecord })
  close(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.projects.close(currentUser(request), id);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Хронология проекта',
    description:
      'Право: projects.read. События с автором и затронутым объектом. Данные ограничены доступом к проекту.',
    operationId: 'projects_history',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('projects.read')
  @ApiOkResponse({ schema: projectHistory })
  history(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.projects.history(currentUser(request), id);
  }

  @Get(':id/comments')
  @ApiOperation({
    summary: 'Комментарии и ответы',
    description:
      'Право: projects.read. parentId связывает ответ с родительским комментарием. Удалённые комментарии остаются с body=null и deletedAt.',
    operationId: 'projects_comments',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('projects.read')
  @ApiOkResponse({ schema: projectComments })
  comments(@Req() request: AuthRequest, @UuidParam('id') id: string) {
    return this.projects.comments(currentUser(request), id);
  }

  @Post(':id/comments')
  @ApiOperation({
    summary: 'Добавить комментарий или ответ',
    description:
      'Право: projects.comments.create. Для ответа укажите parentId существующего неудалённого комментария этого проекта. Пустой после обрезки пробелов текст запрещён.',
    operationId: 'projects_addComment',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('projects.comments.create')
  @ApiCreatedResponse({ schema: projectComment })
  addComment(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @ValidatedBody(CommentDto) body: CommentDto,
  ) {
    return this.projects.addComment(currentUser(request), id, body);
  }

  @Patch(':id/comments/:commentId')
  @ApiOperation({
    summary: 'Изменить комментарий',
    description:
      'Право: projects.comments.update. Редактирование доступно автору или пользователю с уровнем не ниже 20; удалённый комментарий изменять нельзя. parentId этой операцией не меняется.',
    operationId: 'projects_editComment',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('projects.comments.update')
  @ApiOkResponse({ schema: projectComment })
  editComment(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('commentId') commentId: string,
    @ValidatedBody(CommentBodyDto) body: CommentBodyDto,
  ) {
    return this.projects.editComment(
      currentUser(request),
      id,
      commentId,
      body.body,
    );
  }

  @Delete(':id/comments/:commentId')
  @ApiOperation({
    summary: 'Удалить комментарий',
    description:
      'Право: projects.comments.delete. Мягкое удаление: текст очищается, запись и ответы сохраняются. Доступно автору либо пользователю с уровнем не ниже 20.',
    operationId: 'projects_deleteComment',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('projects.comments.delete')
  @ApiOkResponse({ schema: projectComment })
  deleteComment(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('commentId') commentId: string,
  ) {
    return this.projects.deleteComment(currentUser(request), id, commentId);
  }

  @Post(':id/stages/:stageId/document-types/:documentTypeId/files')
  @ApiOperation({
    summary: 'Прикрепить документ к текущему этапу',
    description:
      'Право: projects.files.manage. multipart/form-data с одним file. Непустой файл до 25 МиБ; расширения png, jpg, jpeg, pdf, zip, gz, rar, doc, docx, xls, xlsx. Тип документа должен принадлежать текущему этапу открытого проекта. Проверка выполняется повторно при сохранении.',
    operationId: 'projects_uploadFile',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
    413: 'Превышен допустимый размер файла.',
    429: 'Превышен лимит одновременных операций или сохранённых заданий.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @RequirePermission('projects.files.manage')
  @UseInterceptors(
    UploadLimitInterceptor,
    FileInterceptor('file', {
      limits: {
        files: 1,
        fields: 10,
        parts: 11,
        fieldSize: 4096,
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  @ApiCreatedResponse({ schema: projectFile })
  uploadFile(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('stageId') stageId: string,
    @UuidParam('documentTypeId') documentTypeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.files.upload(
      currentUser(request),
      id,
      stageId,
      documentTypeId,
      file,
    );
  }

  @Get(':id/files/:fileId')
  @ApiOperation({
    summary: 'Скачать файл проекта',
    description:
      'Право: projects.read. Защищённое скачивание через CRM: application/octet-stream, Content-Disposition: attachment, Content-Length. Прямые ссылки и ключи S3 отсутствуют.',
    operationId: 'projects_downloadFile',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
  })
  @RequirePermission('projects.read')
  @ApiOkResponse({
    description: 'Содержимое документа проекта.',
    headers: {
      'Content-Disposition': {
        description: 'attachment; имя файла в UTF-8.',
        schema: { type: 'string' },
      },
      'Content-Length': {
        description: 'Размер в байтах.',
        schema: { type: 'integer' },
      },
    },
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async downloadFile(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('fileId') fileId: string,
  ) {
    const { file, body } = await this.files.download(
      currentUser(request),
      id,
      fileId,
    );
    return new StreamableFile(Buffer.from(body), {
      type: 'application/octet-stream',
      disposition: attachmentDisposition(file.fileName),
      length: file.size,
    });
  }

  @Post(':id/files/:fileId/complete')
  @ApiOperation({
    summary: 'Отметить документ завершённым',
    description:
      'Право: projects.files.manage. Файл должен находиться на текущем этапе открытого проекта. Повторная отметка завершённого файла возвращает его текущее состояние.',
    operationId: 'projects_completeFile',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('projects.files.manage')
  @ApiCreatedResponse({ schema: projectFile })
  completeFile(
    @Req() request: AuthRequest,
    @UuidParam('id') id: string,
    @UuidParam('fileId') fileId: string,
  ) {
    return this.files.complete(currentUser(request), id, fileId);
  }
}
