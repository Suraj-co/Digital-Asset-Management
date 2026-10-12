import { ApiProperty } from '@nestjs/swagger';

export const AUDIT_ACTIONS = [
  'asset_recorded',
  'asset_retried',
  'asset_version_recorded',
  'asset_resubmitted',
  'asset_title_changed',
  'asset_submitted',
  'asset_approved',
  'asset_rejected',
  'asset_published',
  'drive_file_removed',
  'task_planned',
  'task_changed',
  'time_recorded',
  'time_changed',
  'time_submitted',
  'time_accepted',
  'time_returned',
  'membership_granted',
  'creator_invited',
  'membership_revoked',
  'account_disabled',
  'account_enabled',
  'pay_rate_set',
] as const;

export type AuditActionName = (typeof AUDIT_ACTIONS)[number];

export class AuditEventDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SAPL' })
  companyCode!: string;

  @ApiProperty()
  actorEmail!: string;

  @ApiProperty({ enum: AUDIT_ACTIONS })
  action!: AuditActionName;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ nullable: true, type: String })
  subjectType!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  subjectId!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class AuditPageDto {
  @ApiProperty({ type: [AuditEventDto] })
  items!: AuditEventDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}
