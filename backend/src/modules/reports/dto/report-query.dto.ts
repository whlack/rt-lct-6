import { PageDto } from '../../../common/page.dto.js';
import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/** Период задаётся парой включительных дат; programId и productId взаимоисключающие. */
export class ReportFiltersDto {
  @ApiPropertyOptional({
    description:
      'Начало периода включительно; dateTo обязательно вместе с этим полем. Часовой пояс REPORT_TIMEZONE.',
    type: String,
    example: '2026-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;
  @ApiPropertyOptional({
    description:
      'Конец периода включительно; dateFrom обязательно вместе с этим полем.',
    type: String,
    example: '2026-12-31',
    format: 'date',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;
  @ApiPropertyOptional({
    description: 'Идентификатор вуза.',
    example: '22222222-2222-4222-8222-222222222222',
    format: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  universityId?: string;
  @ApiPropertyOptional({
    description: 'Идентификатор ИТ-направления.',
    example: '33333333-3333-4333-8333-333333333333',
    format: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  directionId?: string;
  @ApiPropertyOptional({
    description: 'Идентификатор программы; нельзя сочетать с productId.',
    example: '44444444-4444-4444-8444-444444444444',
    format: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  programId?: string;
  @ApiPropertyOptional({
    description: 'Идентификатор продукта; нельзя сочетать с programId.',
    example: '55555555-5555-4555-8555-555555555555',
    format: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  productId?: string;
  @ApiPropertyOptional({
    description:
      'Идентификатор ответственного КАМ в Keycloak, не локальный User.id.',
    example: '66666666-6666-4666-8666-666666666666',
    format: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  responsibleSubject?: string;
  @ApiPropertyOptional({
    description:
      'Состояние проекта или задания; допустимые значения приведены в enum.',
    type: String,
    enum: ['ACTIVE', 'CLOSED'],
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'CLOSED'])
  status?: 'ACTIVE' | 'CLOSED';
}
/** Контракт ReportQueryDto: типы заданы явно для watch и собранного приложения. */
export class ReportQueryDto extends IntersectionType(
  ReportFiltersDto,
  PageDto,
) {}
