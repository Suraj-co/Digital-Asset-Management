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

export class UpdateTaskDto {
  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;

  @IsOptional()
  @IsIn(['open', 'done'])
  status?: 'open' | 'done';

  @IsOptional()
  @IsUUID()
  assetId?: string | null;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? trimmed(value) : value))
  @IsOptional()
  @IsEmail()
  assigneeEmail?: string | null;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? trimmed(value) : value))
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  deadline?: string | null;

  @IsOptional()
  @IsIn(['low', 'normal', 'high'])
  priority?: 'low' | 'normal' | 'high' | null;
}
