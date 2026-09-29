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
export class ExportRequestDto extends ReportFiltersDto {
  @ApiProperty({ type: String, enum: ['xls', 'xlsx', 'pdf', 'json'] })
  @IsIn(['xls', 'xlsx', 'pdf', 'json'])
  format!: 'xls' | 'xlsx' | 'pdf' | 'json';
  @ApiPropertyOptional({
    type: [String],
    enum: reportColumns,
    minItems: 1,
    maxItems: 16,
    description:
      'Ordered summary columns; omitted selects all. Applies to the summary section of full project reports too.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(16)
  @IsIn(reportColumns, { each: true })
  columns?: ReportColumn[];

  @ApiPropertyOptional({
    type: String,
    description:
      'Full project report without filters; omitted for project summary',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
