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
  @ApiProperty() @IsUUID() universityId!: string;
  @ApiProperty() @IsUUID() directionId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() programId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiProperty() @IsUUID() responsibleSubject!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() licenseSignedAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  licenseExpiresYear?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
  transferStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() licenseSignedAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  licenseExpiresYear?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])
  transferStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export class AssignProjectDto {
  @ApiProperty() @IsUUID() subject!: string;
}

export class DocumentTypeDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @ApiProperty() @IsBoolean() isRequired!: boolean;
}

export class WorkflowStageDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @ApiProperty() @IsIn(['KAM', 'UNIVERSITY']) expectedActor!:
    'KAM' | 'UNIVERSITY';
  @ApiPropertyOptional() @IsOptional() @IsUUID() expectedContactId?: string;
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
  @ApiProperty() @IsUUID() expectedStageId!: string;
}

export class CommentDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
}

export class CommentBodyDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
}
