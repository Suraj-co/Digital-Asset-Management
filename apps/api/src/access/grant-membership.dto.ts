import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';
import { MEMBERSHIP_ROLES, type MembershipRoleName } from './access.types.js';

export class GrantMembershipDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsIn(MEMBERSHIP_ROLES)
  role!: MembershipRoleName;
}
