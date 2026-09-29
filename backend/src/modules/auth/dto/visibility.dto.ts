import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsUUID,
} from 'class-validator';

/** Полная политика КАМ; отсутствующие списки становятся пустыми и допустимы только в SELECTED. */
export class VisibilityDto {
  @ApiProperty({
    description:
      'ASSIGNED — назначения; ALL — все объекты; SELECTED — явные списки.',
    example: 'SELECTED',
    type: String,
    enum: ['ASSIGNED', 'ALL', 'SELECTED'],
  })
  @IsIn(['ASSIGNED', 'ALL', 'SELECTED'])
  mode!: 'ASSIGNED' | 'ALL' | 'SELECTED';

  @ApiPropertyOptional({
    description:
      'Явно выбранные вузы; допустимо только в SELECTED. Максимум 1000 уникальных UUID.',
    example: [],
    type: [String],
    items: { type: 'string', format: 'uuid' },
    default: [],
    maxItems: 1000,
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  universityIds: string[] = [];

  @ApiPropertyOptional({
    description:
      'Явно выбранные проекты; допустимо только в SELECTED. Максимум 1000 уникальных UUID.',
    example: [],
    type: [String],
    items: { type: 'string', format: 'uuid' },
    default: [],
    maxItems: 1000,
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  projectIds: string[] = [];
}
