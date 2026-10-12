import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function trimmed(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const next = value.trim();
  return next.length === 0 ? undefined : next;
}

export class CreateTimeEntryDto {
  @IsUUID()
  companyId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use a work date as YYYY-MM-DD.' })
  workDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  minutes!: number;

  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
