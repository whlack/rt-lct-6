import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Ограниченная пагинация: страница начинается с 1, размер по умолчанию 25. */
export class PageDto {
  @ApiPropertyOptional({
    description: 'Номер страницы, начиная с 1.',
    example: 1,
    type: 'integer',
    default: 1,
    minimum: 1,
    maximum: 1000000,
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
