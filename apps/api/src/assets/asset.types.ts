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

const CLIENT_ACTIONS = ['submit', 'approve', 'reject', 'publish'] as const;
const RECORDED_ACTIONS = [...CLIENT_ACTIONS, 'resubmit'] as const;

export class WorkflowDecisionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  versionId!: string;

  @ApiProperty({ example: 'v001' })
  versionLabel!: string;

  @ApiProperty({ enum: RECORDED_ACTIONS })
  action!: (typeof RECORDED_ACTIONS)[number];

  @ApiProperty({ enum: STAGES })
  fromStage!: (typeof STAGES)[number];

  @ApiProperty({ enum: STAGES })
  toStage!: (typeof STAGES)[number];

  @ApiProperty({ nullable: true, type: String })
  reason!: string | null;

  @ApiProperty()
  detail!: string;

  @ApiProperty()
  actorEmail!: string;

  @ApiProperty()
  createdAt!: string;
}

export class AssetVersionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1 })
  number!: number;

  @ApiProperty({ example: 'v001' })
  label!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  byteSize!: number;

  @ApiProperty()
  contentType!: string;

  @ApiProperty({ enum: ['upload_failed'] })
  state!: 'upload_failed';

  @ApiProperty({ nullable: true, type: String })
  driveFileId!: string | null;

  @ApiProperty({ enum: ['not_configured'] })
  failureClass!: 'not_configured';

  @ApiProperty()
  detail!: string;

  @ApiProperty()
  createdAt!: string;
}

export class AssetDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ example: 'SAPL' })
  companyCode!: string;

  @ApiProperty({ format: 'uuid' })
  folderId!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty({ example: 'SAPL-0001' })
  code!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: ['upload_failed'] })
  state!: 'upload_failed';

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  byteSize!: number;

  @ApiProperty()
  contentType!: string;

  @ApiProperty({ nullable: true, type: String })
  driveFileId!: string | null;

  @ApiProperty({ enum: ['not_configured'] })
  failureClass!: 'not_configured';

  @ApiProperty()
  detail!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ enum: STAGES })
  workflowStage!: (typeof STAGES)[number];

  @ApiProperty({ enum: ['not_started', 'not_run', 'ready'] })
  publication!: 'not_started' | 'not_run' | 'ready';

  @ApiProperty({ enum: CLIENT_ACTIONS, isArray: true })
  actions!: (typeof CLIENT_ACTIONS)[number][];

  @ApiProperty({ type: [WorkflowDecisionDto] })
  decisions!: WorkflowDecisionDto[];

  @ApiProperty({ type: [AssetVersionDto] })
  versions!: AssetVersionDto[];
}

export class AssetPageDto {
  @ApiProperty({ type: [AssetDto] })
  items!: AssetDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}
