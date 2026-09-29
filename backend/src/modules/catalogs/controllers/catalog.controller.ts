import { array, named } from '../../../common/api-schema.js';
import { UuidParam, ValidatedBody } from '../../../common/validated-input.js';
import { Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import {
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
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
  @RequirePermission('catalogs.read')
  @ApiOkResponse({ schema: array(named) })
  list(@Param('kind') kind: string) {
    return this.catalogs.list(kind);
  }

  @Post(':kind')
  @RequirePermission('catalogs.manage')
  @ApiCreatedResponse({ schema: named })
  create(
    @Param('kind') kind: string,
    @ValidatedBody(CatalogItemDto) body: CatalogItemDto,
  ) {
    return this.catalogs.create(kind, body.name);
  }

  @Patch(':kind/:id')
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
