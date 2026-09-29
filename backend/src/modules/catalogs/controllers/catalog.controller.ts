import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors, authenticationErrors } from '../../../common/api-errors.js';
import { array, named } from '../../../common/api-schema.js';
import { UuidParam, ValidatedBody } from '../../../common/validated-input.js';
import { Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../../auth/decorators/permissions.decorator.js';
import { CatalogItemDto } from '../dto/catalog-item.dto.js';
import { CatalogService } from '../services/catalog.service.js';

@ApiParam({ name: 'kind', enum: ['directions', 'programs', 'products'] })
@ApiTags('catalogs')
@ApiBearerAuth()
@Controller('api/catalogs')
export class CatalogController {
  constructor(
    @Inject(CatalogService) private readonly catalogs: CatalogService,
  ) {}

  @Get(':kind')
  @ApiOperation({
    summary: 'Прочитать каталог',
    description:
      'Право: catalogs.read. kind: directions — направления, programs — программы, products — продукты. Возвращается массив без пагинации.',
    operationId: 'catalogs_list',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
  })
  @RequirePermission('catalogs.read')
  @ApiOkResponse({ schema: array(named) })
  list(@Param('kind') kind: string) {
    return this.catalogs.list(kind);
  }

  @Post(':kind')
  @ApiOperation({
    summary: 'Создать запись каталога',
    description:
      'Право: catalogs.manage. Имя нормализуется: краевые пробелы удаляются, последовательности внутренних пробелов сводятся к одному; уникальность без регистра.',
    operationId: 'catalogs_create',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('catalogs.manage')
  @ApiCreatedResponse({ schema: named })
  create(
    @Param('kind') kind: string,
    @ValidatedBody(CatalogItemDto) body: CatalogItemDto,
  ) {
    return this.catalogs.create(kind, body.name);
  }

  @Patch(':kind/:id')
  @ApiOperation({
    summary: 'Переименовать запись каталога',
    description:
      'Право: catalogs.manage. Отображаемое написание обновляется, normalizedName вычисляет БД. Идентификатор и связи проектов сохраняются.',
    operationId: 'catalogs_update',
  })
  @ApiErrors({
    ...authenticationErrors,
    400: 'Неверный UUID, параметры или тело запроса; нарушено предметное ограничение.',
    404: 'Запись отсутствует или недоступна в текущей области видимости.',
    409: 'Конфликт текущего состояния; обновите данные или дождитесь завершения задания.',
  })
  @RequirePermission('catalogs.manage')
  @ApiOkResponse({ schema: named })
  update(
    @Param('kind') kind: string,
    @UuidParam('id') id: string,
    @ValidatedBody(CatalogItemDto) body: CatalogItemDto,
  ) {
    return this.catalogs.update(kind, id, body.name);
  }
}
