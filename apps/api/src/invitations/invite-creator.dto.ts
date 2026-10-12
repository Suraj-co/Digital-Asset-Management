import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

function trimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class InviteCreatorDto {
  @Transform(({ value }: { value: unknown }) => trimmed(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12, { message: 'Use 12 to 200 characters.' })
  @MaxLength(200, { message: 'Use 12 to 200 characters.' })
  password!: string;
}
