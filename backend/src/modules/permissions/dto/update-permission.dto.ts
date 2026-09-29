import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Изменение минимального уровня права; управление правами и видимостью всегда требует 30. */
export class UpdatePermissionDto {
  @ApiProperty({
    description: 'Минимальный уровень права: 10, 20 или 30.',
    type: 'integer',
    enum: [10, 20, 30],
    example: 20,
  })
  @IsIn([10, 20, 30])
  minimumLevel!: 10 | 20 | 30;
}
