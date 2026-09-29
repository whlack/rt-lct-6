import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsUUID,
} from 'class-validator';

export class VisibilityDto {
  @ApiProperty({ type: String, enum: ['ASSIGNED', 'ALL', 'SELECTED'] })
  @IsIn(['ASSIGNED', 'ALL', 'SELECTED'])
  mode!: 'ASSIGNED' | 'ALL' | 'SELECTED';

  @ApiPropertyOptional({ type: [String], default: [], maxItems: 1000 })
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  universityIds: string[] = [];

  @ApiPropertyOptional({ type: [String], default: [], maxItems: 1000 })
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  projectIds: string[] = [];
}
