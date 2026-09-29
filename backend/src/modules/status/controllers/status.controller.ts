import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { StatusService } from '../services/status.service.js';
import { Public } from '../../auth/decorators/public.decorator.js';

@ApiTags('status')
@Controller('api')
export class StatusController {
  constructor(@Inject(StatusService) private readonly status: StatusService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Публичная конфигурация входа',
    description:
      'Публичная операция. Доступна без токена. Только URL Keycloak, realm и публичный clientId; серверные credentials не выдаются.',
    operationId: 'status_config',
  })
  @Public()
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['keycloak'],
      properties: {
        keycloak: {
          type: 'object',
          required: ['url', 'realm', 'clientId'],
          properties: {
            url: { type: 'string' },
            realm: { type: 'string' },
            clientId: { type: 'string' },
          },
        },
      },
    },
  })
  config() {
    return this.status.publicConfig();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Проверка работоспособности процесса',
    description:
      'Публичная операция. Доступна без токена. Не проверяет внешние зависимости.',
    operationId: 'status_health',
  })
  @Public()
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['status'],
      properties: { status: { type: 'string', enum: ['ok'], example: 'ok' } },
    },
  })
  health(): { status: 'ok' } {
    return this.status.health();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Проверка готовности PostgreSQL',
    description:
      'Публичная операция. Доступна без токена. Проверяет SELECT 1; недоступность интеграций LMS/сайта не влияет на готовность API.',
    operationId: 'status_ready',
  })
  @Public()
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['status'],
      properties: { status: { type: 'string', enum: ['ok'], example: 'ok' } },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'PostgreSQL недоступен.',
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['unavailable'],
          example: 'unavailable',
        },
      },
    },
  })
  async ready(): Promise<{ status: 'ok' }> {
    const result = await this.status.ready();
    if (result.status !== 'ok') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { status: 'ok' };
  }
}
