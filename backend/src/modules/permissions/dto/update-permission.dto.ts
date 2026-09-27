import { IsIn } from 'class-validator';

export class UpdatePermissionDto {
  @IsIn([10, 20, 30])
  minimumLevel!: 10 | 20 | 30;
}
