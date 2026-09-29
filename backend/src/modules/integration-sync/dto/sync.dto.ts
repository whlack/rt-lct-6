import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
/** Пагинация истории источника: максимум 100 записей и ограниченный номер страницы. */
export class SyncPageDto {
  @ApiPropertyOptional({
    description: 'Номер страницы, начиная с 1.',
    example: 1,
    maximum: 1000000,
    type: 'integer',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({
    description: 'Число записей на странице: от 1 до 100, по умолчанию 25.',
    example: 25,
    type: 'integer',
    default: 25,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
/** Публичный аудит запуска без аренды, execution ID, токенов и внешних данных. */
export class SyncRunDto {
  @ApiProperty({
    description: 'Идентификатор записи CRM.',
    example: '11111111-1111-4111-8111-111111111111',
    type: String,
    format: 'uuid',
  })
  id!: string;
  @ApiProperty({
    description: 'Источник интеграции.',
    example: 'LMS',
    type: String,
    enum: ['LMS', 'WEBSITE'],
  })
  source!: string;
  @ApiProperty({
    description: 'Способ запуска: ручной либо по расписанию.',
    example: 'MANUAL',
    type: String,
    enum: ['MANUAL', 'SCHEDULED'],
  })
  trigger!: string;
  @ApiProperty({
    description: 'Локальный ID инициатора; null для планового запуска.',
    type: String,
    nullable: true,
    format: 'uuid',
  })
  initiatorId!: string | null;
  @ApiProperty({
    description:
      'Состояние проекта или задания; допустимые значения приведены в enum.',
    type: String,
    enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'],
  })
  status!: string;
  @ApiProperty({
    description: 'Время создания в ISO 8601.',
    example: '2026-01-15T09:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt!: string;
  @ApiProperty({
    description: 'Время начала выполнения; null до запуска.',
    type: String,
    nullable: true,
    format: 'date-time',
  })
  startedAt!: string | null;
  @ApiProperty({
    description: 'Время завершения; null до окончания.',
    type: String,
    nullable: true,
    format: 'date-time',
  })
  completedAt!: string | null;
  @ApiProperty({
    description: 'Число начатых попыток выполнения, максимум три.',
    example: 0,
    type: 'integer',
    minimum: 0,
    maximum: 3,
  })
  attempts!: number;
  @ApiProperty({
    description: 'Время следующей попытки; null, если повтор не запланирован.',
    type: String,
    nullable: true,
    format: 'date-time',
  })
  nextAttemptAt!: string | null;
  @ApiProperty({
    description:
      'Безопасный технический код ошибки; null при отсутствии ошибки.',
    type: String,
    nullable: true,
    enum: [
      'SOURCE_NOT_IMPLEMENTED',
      'INVALID_DATA',
      'ACCESS_UNAVAILABLE',
      'TEMPORARY_FAILURE',
      'RETRY_EXHAUSTED',
    ],
  })
  errorCode!: string | null;
  @ApiProperty({
    description: 'Плановый слот запуска; null для ручного задания.',
    type: String,
    nullable: true,
    format: 'date-time',
  })
  scheduledAt!: string | null;
}
/** Состояние адаптера; NOT_IMPLEMENTED никогда не планирует следующий запуск. */
export class SyncStateDto {
  @ApiProperty({
    description: 'Источник интеграции.',
    example: 'LMS',
    type: String,
    enum: ['LMS', 'WEBSITE'],
  })
  source!: string;
  @ApiProperty({
    description:
      'Готовность адаптера; настоящие LMS и сайт сейчас NOT_IMPLEMENTED.',
    type: String,
    enum: ['READY', 'NOT_IMPLEMENTED'],
    example: 'NOT_IMPLEMENTED',
  })
  availability!: string;
  @ApiProperty({
    description: 'Причина недоступности источника.',
    type: String,
    nullable: true,
    example: 'SOURCE_NOT_IMPLEMENTED',
  })
  reason!: string | null;
  @ApiProperty({
    description: 'Интервал расписания в секундах.',
    type: 'integer',
    example: 3600,
  })
  intervalSeconds!: number;
  @ApiProperty({
    description:
      'Следующий плановый запуск; null для нереализованного источника.',
    type: String,
    nullable: true,
    format: 'date-time',
    example: null,
  })
  nextRunAt!: string | null;
  @ApiProperty({
    description: 'Последнее задание источника или null, если заданий не было.',
    type: SyncRunDto,
    nullable: true,
    example: null,
  })
  lastRun!: SyncRunDto | null;
}
/** Идентификатор принятого запуска; неготовый источник возвращает 409 вместо этой модели. */
export class SyncStartDto {
  @ApiProperty({
    description: 'Идентификатор принятого запуска.',
    example: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    type: String,
    format: 'uuid',
  })
  runId!: string;
}
/** Страница истории: createdAt DESC, id DESC; только пользователям с integrations.manage. */
export class SyncHistoryDto {
  @ApiProperty({
    description: 'Записи выбранной страницы.',
    type: [SyncRunDto],
  })
  rows!: SyncRunDto[];
  @ApiProperty({
    description: 'Общее число подходящих записей до пагинации.',
    example: 0,
    type: 'integer',
  })
  total!: number;
  @ApiProperty({
    description: 'Номер страницы, начиная с 1.',
    type: 'integer',
    example: 1,
  })
  page!: number;
  @ApiProperty({
    description: 'Число записей на странице: от 1 до 100, по умолчанию 25.',
    type: 'integer',
    example: 25,
  })
  pageSize!: number;
}
