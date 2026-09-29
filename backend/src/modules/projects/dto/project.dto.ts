import { PageDto } from '../../../common/page.dto.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Создание проекта требует ровно одной программы/продукта; ответственный задаётся subject Keycloak. */
export class CreateProjectDto {
  @ApiProperty({
    description: 'Идентификатор вуза.',
    example: '22222222-2222-4222-8222-222222222222',
    format: 'uuid',
    type: String,
  })
  @IsUUID()
  universityId!: string;
  @ApiProperty({
    description: 'Идентификатор ИТ-направления.',
    example: '33333333-3333-4333-8333-333333333333',
    format: 'uuid',
    type: String,
  })
  @IsUUID()
  directionId!: string;
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
  @ApiProperty({
    description:
      'Идентификатор ответственного КАМ в Keycloak, не локальный User.id.',
    example: '66666666-6666-4666-8666-666666666666',
    format: 'uuid',
    type: String,
  })
  @IsUUID()
  responsibleSubject!: string;
  @ApiPropertyOptional({
    description: 'Вендор проекта.',
    example: 'Тестовый вендор',
    maxLength: 200,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string;
  @ApiPropertyOptional({
    description: 'Номер договора.',
    example: 'TEST-2026-01',
    maxLength: 200,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractNumber?: string;
  @ApiPropertyOptional({
    description: 'Дата подписания: YYYY-MM-DD или дата и время ISO 8601.',
    example: '2026-01-15T09:00:00.000Z',
    oneOf: [
      { type: 'string', format: 'date' },
      { type: 'string', format: 'date-time' },
    ],
    type: String,
  })
  @IsOptional()
  @IsDateString()
  licenseSignedAt?: string;
  @ApiPropertyOptional({
    description: 'Год окончания лицензии: от 2000 до 2100.',
    example: 2027,
    minimum: 2000,
    maximum: 2100,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  licenseExpiresYear?: number;
  @ApiPropertyOptional({
    description: 'Статус передачи: не начата, выполняется, завершена.',
    example: 'NOT_STARTED',
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
    type: String,
  })
  @IsOptional()
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
  transferStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

/** Частичное изменение: пропущенные поля сохраняются; nullable-поля можно очистить значением null. */
export class UpdateProjectDto {
  @ApiPropertyOptional({
    description: 'Вендор проекта.',
    example: 'Тестовый вендор',
    maxLength: 200,
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string | null;
  @ApiPropertyOptional({
    description: 'Номер договора.',
    example: 'TEST-2026-01',
    maxLength: 200,
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractNumber?: string | null;
  @ApiPropertyOptional({
    description: 'Дата подписания: YYYY-MM-DD или дата и время ISO 8601.',
    example: '2026-01-15T09:00:00.000Z',
    oneOf: [
      { type: 'string', format: 'date' },
      { type: 'string', format: 'date-time' },
    ],
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  licenseSignedAt?: string | null;
  @ApiPropertyOptional({
    description: 'Год окончания лицензии: от 2000 до 2100.',
    example: 2027,
    minimum: 2000,
    maximum: 2100,
    type: 'integer',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  licenseExpiresYear?: number | null;
  @ApiPropertyOptional({
    description: 'Статус передачи: не начата, выполняется, завершена.',
    example: 'NOT_STARTED',
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
    type: String,
  })
  @IsOptional()
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
  transferStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

/** Назначение сотрудника использует subject Keycloak, а не локальный ID CRM. */
export class AssignProjectDto {
  @ApiProperty({
    description: 'Идентификатор сотрудника в Keycloak, не локальный User.id.',
    example: '66666666-6666-4666-8666-666666666666',
    format: 'uuid',
    type: String,
  })
  @IsUUID()
  subject!: string;
}

/** Требование к документу этапа; обязательность проверяется при переходе и закрытии. */
export class DocumentTypeDto {
  @ApiProperty({
    description: 'Отображаемое название или имя.',
    example: 'Тестовое название',
    maxLength: 160,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;
  @ApiProperty({
    description: 'Обязательность документа для перехода или закрытия проекта.',
    example: true,
    type: Boolean,
  })
  @IsBoolean()
  isRequired!: boolean;
}

/** Последующий этап workflow: UNIVERSITY требует контакт вуза, KAM его не принимает. */
export class WorkflowStageDto {
  @ApiProperty({
    description: 'Название этапа; не повторяет другие этапы и начальный этап.',
    example: 'Согласование',
    maxLength: 200,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
  @ApiProperty({
    description: 'Сторона, от которой ожидается действие на этапе.',
    example: 'KAM',
    enum: ['KAM', 'UNIVERSITY'],
    type: String,
  })
  @IsIn(['KAM', 'UNIVERSITY'])
  expectedActor!: 'KAM' | 'UNIVERSITY';
  @ApiPropertyOptional({
    description:
      'Контакт текущего вуза: обязателен для UNIVERSITY, запрещён для KAM.',
    example: '77777777-7777-4777-8777-777777777777',
    format: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  expectedContactId?: string;
  @ApiProperty({
    description:
      'Типы документов этапа, до 30; названия уникальны внутри этапа.',
    maxItems: 30,
    type: [DocumentTypeDto],
  })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => DocumentTypeDto)
  documentTypes!: DocumentTypeDto[];
}

/** Заменяет только последующие этапы, сохраняя начальное «Формирование проекта». */
export class ConfigureWorkflowDto {
  @ApiProperty({
    description:
      'Последующие этапы без неизменяемого начального этапа; от 1 до 20.',
    maxItems: 20,
    minItems: 1,
    type: [WorkflowStageDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStageDto)
  stages!: WorkflowStageDto[];
}

/** Идентификатор ожидаемого текущего этапа защищает переход от устаревшей карточки. */
export class AdvanceStageDto {
  @ApiProperty({
    description:
      'ID текущего этапа из последней карточки; защищает от конкурентного перехода.',
    example: '88888888-8888-4888-8888-888888888888',
    format: 'uuid',
    type: String,
  })
  @IsUUID()
  expectedStageId!: string;
}

/** Новый комментарий либо ответ существующему комментарию этого проекта. */
export class CommentDto {
  @ApiProperty({
    description: 'Непустой текст комментария до 5000 символов.',
    example: 'Тестовый комментарий',
    maxLength: 5000,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
  @ApiPropertyOptional({
    description:
      'ID родительского комментария для ответа; без поля создаётся отдельный комментарий.',
    example: '99999999-9999-4999-8999-999999999999',
    format: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

/** Редактирование меняет только текст; связь с родителем не изменяется. */
export class CommentBodyDto {
  @ApiProperty({
    description: 'Непустой текст комментария до 5000 символов.',
    example: 'Тестовый комментарий',
    maxLength: 5000,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
}

/** Фильтры ограниченного реестра; каждый фильтр применяется дополнительно к области видимости. */
/** Фильтры реестра применяются вместе с областью видимости пользователя. */
export class ProjectQueryDto extends PageDto {
  @ApiPropertyOptional({
    description:
      'Только открытые проекты, текущий этап которых ожидает KAM. Передайте строку true; для отключения фильтра уберите параметр.',
    type: String,
    enum: ['true'],
    example: 'true',
  })
  @IsOptional()
  @IsIn(['true'])
  actionRequired?: 'true';
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
    description:
      'Фильтр по программе. В реестре совместно с productId применяется как AND.',
    example: '44444444-4444-4444-8444-444444444444',
    format: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsUUID()
  programId?: string;
  @ApiPropertyOptional({
    description:
      'Фильтр по продукту. В реестре совместно с programId применяется как AND.',
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
    description: 'Состояние проекта: ACTIVE — открыт, CLOSED — закрыт.',
    type: String,
    enum: ['ACTIVE', 'CLOSED'],
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'CLOSED'])
  status?: 'ACTIVE' | 'CLOSED';
  @ApiPropertyOptional({
    description:
      'Поиск по названию вуза, направления, программы/продукта и номеру договора; регистр не учитывается.',
    example: 'Тестовый',
    type: String,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
