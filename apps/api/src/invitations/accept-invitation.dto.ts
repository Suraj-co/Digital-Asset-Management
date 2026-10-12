import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @MinLength(20)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(12, { message: 'Use 12 to 200 characters.' })
  @MaxLength(200, { message: 'Use 12 to 200 characters.' })
  password!: string;
}
