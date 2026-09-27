import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/decorators/permissions.decorator.js';
import { CatalogItemDto } from '../dto/catalog-item.dto.js';
import { CatalogService } from '../services/catalog.service.js';

@ApiTags('catalogs')
@ApiBearerAuth()
@Controller('api/catalogs')
export class CatalogController {
  constructor(
    @Inject(CatalogService) private readonly catalogs: CatalogService,
  ) {}

  @Get(':kind')
  @RequirePermission('catalogs.read')
  list(@Param('kind') kind: string) {
    return this.catalogs.list(kind);
  }

  @Post(':kind')
  @RequirePermission('catalogs.manage')
  create(@Param('kind') kind: string, @Body() body: CatalogItemDto) {
    return this.catalogs.create(kind, body.name);
  }

  @Patch(':kind/:id')
  @RequirePermission('catalogs.manage')
  update(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CatalogItemDto,
  ) {
    return this.catalogs.update(kind, id, body.name);
  }
}
