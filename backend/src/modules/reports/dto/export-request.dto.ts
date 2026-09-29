import { reportColumns, type ReportColumn } from './report-columns.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ReportFiltersDto } from './report-query.dto.js';
/** Сводка с фильтрами либо полный отчёт projectId без фильтров; выполнение в worker. */
export class ExportRequestDto extends ReportFiltersDto {
  @ApiProperty({
    description: 'Формат результирующего файла.',
    type: String,
    enum: ['xls', 'xlsx', 'pdf', 'json'],
  })
  @IsIn(['xls', 'xlsx', 'pdf', 'json'])
  format!: 'xls' | 'xlsx' | 'pdf' | 'json';
  @ApiPropertyOptional({
    description:
      'Порядок колонок сводки; без поля выбираются все. Применяется и к сводке полного отчёта.',
    type: [String],
    enum: reportColumns,
    minItems: 1,
    maxItems: 16,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(16)
  @IsIn(reportColumns, { each: true })
  columns?: ReportColumn[];

  @ApiPropertyOptional({
    description:
      'Полный отчёт этого проекта без фильтров; для сводки поле не передаётся.',
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    format: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
