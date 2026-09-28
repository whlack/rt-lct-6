import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  PickType,
  ApiTags,
} from '@nestjs/swagger';
import {
  currentUser,
  RequirePermission,
  type AuthRequest,
} from '../../auth/index.js';
import { positiveInteger } from '../../../config/jobs.js';
import { ImportService } from '../services/import.service.js';
import { ReportQueryDto } from '../../reports/index.js';
class ImportPageDto extends PickType(ReportQueryDto, [
  'page',
  'pageSize',
] as const) {}
@ApiTags('catalog-imports')
@ApiBearerAuth()
@RequirePermission('catalogs.import')
@ApiBadRequestResponse({ description: 'Invalid file, UUID or pagination' })
@ApiForbiddenResponse({ description: 'Permission revoked' })
@ApiGoneResponse({ description: 'Source and row results expired' })
@ApiNotFoundResponse({ description: 'Import does not belong to the caller' })
@Controller('api/catalog-imports')
export class ImportController {
  constructor(@Inject(ImportService) private readonly imports: ImportService) {}
  @Post()
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiAcceptedResponse({
    description: 'Validation queued; apply is a separate operation',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: positiveInteger('IMPORT_MAX_BYTES', 10485760) },
    }),
  )
  upload(
    @Req() request: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.imports.upload(currentUser(request), file);
  }
  @Get(':id')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'PREVIEW' },
        phase: { type: 'string', enum: ['VALIDATE', 'APPLY'] },
        progress: { type: 'integer', minimum: 0, maximum: 100 },
        counts: {
          type: 'object',
          additionalProperties: { type: 'integer' },
          example: { total: 3, CREATE: 1, SKIP: 1, ERROR: 1 },
        },
        total: { type: 'integer' },
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
        rows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              sheet: { type: 'string', example: 'Вузы' },
              rowNumber: { type: 'integer', example: 2 },
              key: { type: 'string' },
              data: { type: 'object' },
              action: {
                type: 'string',
                enum: ['CREATE', 'UPDATE', 'SKIP', 'ERROR'],
              },
              result: {
                type: 'string',
                enum: ['PENDING', 'CREATED', 'UPDATED', 'SKIPPED', 'ERROR'],
              },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    column: { type: 'string' },
                    code: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        errorCode: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        startedAt: { type: 'string', nullable: true },
        completedAt: { type: 'string', nullable: true },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Own import status and paginated row preview/result; errors workbook at /api/jobs/:id/file',
  })
  get(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ImportPageDto,
  ) {
    return this.imports.get(
      currentUser(request),
      id,
      query.page,
      query.pageSize,
    );
  }
  @Post(':id/apply')
  @HttpCode(202)
  @ApiAcceptedResponse({
    description: 'Valid rows will be rechecked and applied once',
  })
  apply(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.apply(currentUser(request), id);
  }
}
