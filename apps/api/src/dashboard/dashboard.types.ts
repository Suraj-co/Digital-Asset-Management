import { ApiProperty } from '@nestjs/swagger';

const STAGES = [
  'draft',
  'scope_analysis',
  'rm_qc',
  'rm_approval',
  'admin_qc',
  'admin_approval',
  'changes_requested',
] as const;

export class DashboardStageCountsDto {
  @ApiProperty()
  draft!: number;

  @ApiProperty()
  scope_analysis!: number;

  @ApiProperty()
  rm_qc!: number;

  @ApiProperty()
  rm_approval!: number;

  @ApiProperty()
  admin_qc!: number;

  @ApiProperty()
  admin_approval!: number;

  @ApiProperty()
  changes_requested!: number;
}

export class DashboardAssetCountsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty({ description: 'Assets whose recorded state is upload_failed. The file is not stored.' })
  uploadFailed!: number;

  @ApiProperty()
  publicationNotStarted!: number;

  @ApiProperty({ description: 'Publication was attempted and did not move a file.' })
  publicationNotRun!: number;

  @ApiProperty({ description: 'Admin approved the latest version. It is ready to publish.' })
  publicationReady!: number;

  @ApiProperty({ type: DashboardStageCountsDto })
  byStage!: DashboardStageCountsDto;
}

export class DashboardQueueCountsDto {
  @ApiProperty()
  drafts!: number;

  @ApiProperty()
  rmReview!: number;

  @ApiProperty()
  changesRequested!: number;

  @ApiProperty()
  adminReview!: number;

  @ApiProperty()
  readyToPublish!: number;
}

export class DashboardTaskCountsDto {
  @ApiProperty()
  open!: number;

  @ApiProperty()
  done!: number;
}

export class DashboardTimeCountsDto {
  @ApiProperty()
  open!: number;

  @ApiProperty()
  submitted!: number;

  @ApiProperty()
  accepted!: number;

  @ApiProperty()
  returned!: number;

  @ApiProperty({ description: 'Sum of minutes stored on the counted rows.' })
  minutes!: number;
}

export class DashboardPayrollDto {
  @ApiProperty({ description: 'Accepted minutes only. Open, submitted, and returned minutes are excluded.' })
  acceptedMinutes!: number;

  @ApiProperty({ nullable: true, type: Number, description: 'Company hourly rate in minor units. Null until an admin sets it.' })
  hourlyRateMinor!: number | null;

  @ApiProperty({ enum: ['INR', 'USD', 'EUR'] })
  currency!: 'INR' | 'USD' | 'EUR';

  @ApiProperty({ nullable: true, type: Number, description: 'Accepted minutes times the hourly rate, in minor units.' })
  amountMinor!: number | null;

  @ApiProperty()
  detail!: string;
}

export class DashboardDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ example: 'SAPL' })
  companyCode!: string;

  @ApiProperty({ enum: ['own', 'review', 'company'] })
  scope!: 'own' | 'review' | 'company';

  @ApiProperty({ type: DashboardAssetCountsDto })
  assets!: DashboardAssetCountsDto;

  @ApiProperty({ type: DashboardQueueCountsDto })
  queues!: DashboardQueueCountsDto;

  @ApiProperty({ type: DashboardTaskCountsDto })
  tasks!: DashboardTaskCountsDto;

  @ApiProperty({ type: DashboardTimeCountsDto })
  time!: DashboardTimeCountsDto;

  @ApiProperty({ type: DashboardPayrollDto })
  payroll!: DashboardPayrollDto;
}

export const WORKFLOW_STAGES = STAGES;
