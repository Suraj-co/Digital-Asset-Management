import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimmed(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const next = value.trim();
  return next.length === 0 ? undefined : next;
}

export class CreateTaskDto {
  @IsUUID()
  companyId!: string;

  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsOptional()
  @IsEmail()
  assigneeEmail?: string;

  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deadline?: string;

  @IsOptional()
  @IsIn(['low', 'normal', 'high'])
  priority?: 'low' | 'normal' | 'high';
}
