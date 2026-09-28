import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ReportFiltersDto } from './report-query.dto.js';
export class ExportRequestDto extends ReportFiltersDto {
  @ApiProperty({ enum: ['xls', 'xlsx', 'pdf'] })
  @IsIn(['xls', 'xlsx', 'pdf'])
  format!: 'xls' | 'xlsx' | 'pdf';
  @ApiPropertyOptional({
    description:
      'Full project report without filters; omitted for project summary',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
