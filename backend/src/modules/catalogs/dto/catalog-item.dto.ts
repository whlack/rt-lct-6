import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Название нормализуется одинаково при ручном вводе и импорте. */
export class CatalogItemDto {
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
