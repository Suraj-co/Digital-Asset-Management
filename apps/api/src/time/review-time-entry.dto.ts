import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const ACTIONS = ['submit', 'accept', 'return'] as const;

export class ReviewTimeEntryDto {
  @IsIn(ACTIONS)
  action!: (typeof ACTIONS)[number];

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
