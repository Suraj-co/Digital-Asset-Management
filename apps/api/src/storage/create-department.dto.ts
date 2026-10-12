import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

export class CreateDepartmentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,79}$/, {
    message: 'Use letters, numbers, spaces, hyphens, or underscores.',
  })
  name!: string;
}
