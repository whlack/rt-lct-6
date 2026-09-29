import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
export class SyncPageDto {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({ type: Number, default: 25, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
export class SyncRunDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, enum: ['LMS', 'WEBSITE'] }) source!: string;
  @ApiProperty({ type: String, enum: ['MANUAL', 'SCHEDULED'] })
  trigger!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) initiatorId!:
    string | null;
  @ApiProperty({
    type: String,
    enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'],
  })
  status!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  startedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  completedAt!: string | null;
  @ApiProperty({ type: Number, minimum: 0, maximum: 3 }) attempts!: number;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  nextAttemptAt!: string | null;
  @ApiProperty({
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
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  scheduledAt!: string | null;
}
export class SyncStateDto {
  @ApiProperty({ type: String, enum: ['LMS', 'WEBSITE'] }) source!: string;
  @ApiProperty({
    type: String,
    enum: ['READY', 'NOT_IMPLEMENTED'],
    example: 'NOT_IMPLEMENTED',
  })
  availability!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'SOURCE_NOT_IMPLEMENTED',
  })
  reason!: string | null;
  @ApiProperty({ type: Number, example: 3600 }) intervalSeconds!: number;
  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    example: null,
  })
  nextRunAt!: string | null;
  @ApiProperty({ type: SyncRunDto, nullable: true, example: null })
  lastRun!: SyncRunDto | null;
}
export class SyncStartDto {
  @ApiProperty({ type: String, format: 'uuid' }) runId!: string;
}
export class SyncHistoryDto {
  @ApiProperty({ type: [SyncRunDto] }) rows!: SyncRunDto[];
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number, example: 1 }) page!: number;
  @ApiProperty({ type: Number, example: 25 }) pageSize!: number;
}
