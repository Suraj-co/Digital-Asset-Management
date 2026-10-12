import { ApiProperty } from '@nestjs/swagger';

export const MEMBERSHIP_ROLES = ['creator', 'rm', 'admin'] as const;
export type MembershipRoleName = (typeof MEMBERSHIP_ROLES)[number];

export class CompanyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SAPL' })
  code!: string;

  @ApiProperty({ example: 'SAPL' })
  name!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ enum: MEMBERSHIP_ROLES, isArray: true })
  roles!: MembershipRoleName[];
}

export class CompanyPageDto {
  @ApiProperty({ type: [CompanyDto] })
  items!: CompanyDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}

export class MembershipDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'person@example.com' })
  email!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ example: 'Ontale' })
  companyCode!: string;

  @ApiProperty({ enum: MEMBERSHIP_ROLES })
  role!: MembershipRoleName;
}

export class UserMembershipDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ example: 'SAPL' })
  companyCode!: string;

  @ApiProperty({ enum: MEMBERSHIP_ROLES })
  role!: MembershipRoleName;
}

export class ManagedUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'person@example.com' })
  email!: string;

  @ApiProperty({ enum: ['active', 'disabled'] })
  status!: 'active' | 'disabled';

  @ApiProperty({ type: [UserMembershipDto] })
  memberships!: UserMembershipDto[];
}

export class UserPageDto {
  @ApiProperty({ type: [ManagedUserDto] })
  items!: ManagedUserDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}
