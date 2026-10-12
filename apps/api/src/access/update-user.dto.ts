import { IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsIn(['active', 'disabled'])
  status!: 'active' | 'disabled';
}
