import { PageDto } from '../../../common/page.dto.js';
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class ReportFiltersDto {
  @ApiPropertyOptional({ type: String, example: '2026-01-01', format: 'date' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;
  @ApiPropertyOptional({ type: String, example: '2026-12-31', format: 'date' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  universityId?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  directionId?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  programId?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  productId?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  responsibleSubject?: string;
  @ApiPropertyOptional({ type: String, enum: ['ACTIVE', 'CLOSED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'CLOSED'])
  status?: 'ACTIVE' | 'CLOSED';
}
export class ReportQueryDto extends IntersectionType(
  ReportFiltersDto,
  PageDto,
) {}
