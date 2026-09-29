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

export class CreateProjectDto {
  @ApiProperty({ type: String }) @IsUUID() universityId!: string;
  @ApiProperty({ type: String }) @IsUUID() directionId!: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  programId?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  productId?: string;
  @ApiProperty({ type: String }) @IsUUID() responsibleSubject!: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractNumber?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsDateString()
  licenseSignedAt?: string;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  licenseExpiresYear?: number;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
  transferStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractNumber?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsDateString()
  licenseSignedAt?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  licenseExpiresYear?: number | null;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
  transferStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export class AssignProjectDto {
  @ApiProperty({ type: String }) @IsUUID() subject!: string;
}

export class DocumentTypeDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;
  @ApiProperty({ type: Boolean }) @IsBoolean() isRequired!: boolean;
}

export class WorkflowStageDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
  @ApiProperty({ type: String }) @IsIn(['KAM', 'UNIVERSITY']) expectedActor!:
    'KAM' | 'UNIVERSITY';
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  expectedContactId?: string;
  @ApiProperty({ type: [DocumentTypeDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => DocumentTypeDto)
  documentTypes!: DocumentTypeDto[];
}

export class ConfigureWorkflowDto {
  @ApiProperty({ type: [WorkflowStageDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStageDto)
  stages!: WorkflowStageDto[];
}

export class AdvanceStageDto {
  @ApiProperty({ type: String }) @IsUUID() expectedStageId!: string;
}

export class CommentDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class CommentBodyDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
}
