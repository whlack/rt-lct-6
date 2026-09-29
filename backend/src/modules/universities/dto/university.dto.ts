import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Отображаемое название; normalizedName и уникальность вычисляет PostgreSQL. */
export class UniversityDto {
  @ApiProperty({
    description: 'Отображаемое название или имя.',
    example: 'Тестовое название',
    maxLength: 200,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}

/** Контакт требует имени и хотя бы одного канала связи; null очищает необязательный канал. */
export class ContactDto {
  @ApiProperty({
    description: 'Отображаемое название или имя.',
    example: 'Тестовое название',
    maxLength: 200,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description: 'Адрес электронной почты.',
    example: 'contact@example.org',
    format: 'email',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({
    description: 'Телефон контакта до 60 символов.',
    example: '+7 000 000-00-00',
    maxLength: 60,
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string | null;
}

/** Основной контакт должен принадлежать выбранному вузу. */
export class PrimaryContactDto {
  @ApiProperty({
    description: 'Идентификатор контакта этого вуза.',
    example: '77777777-7777-4777-8777-777777777777',
    format: 'uuid',
    type: String,
  })
  @IsUUID()
  contactId!: string;
}

/** Назначение КАМ из Keycloak на доступный вуз. */
export class AssigneeDto {
  @ApiProperty({
    description: 'Идентификатор сотрудника в Keycloak, не локальный User.id.',
    example: '66666666-6666-4666-8666-666666666666',
    format: 'uuid',
    type: String,
  })
  @IsUUID()
  subject!: string;
}
