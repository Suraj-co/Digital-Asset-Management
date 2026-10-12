import { ApiProperty } from '@nestjs/swagger';

export class TaskDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ example: 'SAPL' })
  companyCode!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  detail!: string;

  @ApiProperty({ enum: ['open', 'done'] })
  status!: 'open' | 'done';

  @ApiProperty({
    enum: [
      'draft',
      'assigned',
      'in_progress',
      'submitted_rm_qc',
      'rm_approved',
      'submitted_admin_qc',
      'admin_approved',
      'ready_to_publish',
      'completed',
      'changes_requested',
    ],
  })
  stage!:
    | 'draft'
    | 'assigned'
    | 'in_progress'
    | 'submitted_rm_qc'
    | 'rm_approved'
    | 'submitted_admin_qc'
    | 'admin_approved'
    | 'ready_to_publish'
    | 'completed'
    | 'changes_requested';

  @ApiProperty({ type: [String] })
  actions!: string[];

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  departmentId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  departmentName!: string | null;

  @ApiProperty({ nullable: true, type: String, example: '2026-10-20' })
  deadline!: string | null;

  @ApiProperty({ enum: ['low', 'normal', 'high'], nullable: true })
  priority!: 'low' | 'normal' | 'high' | null;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  assetId!: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'SAPL-0001' })
  assetCode!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  assigneeId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  assigneeEmail!: string | null;

  @ApiProperty()
  createdByEmail!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class TaskCommentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  authorEmail!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  createdAt!: string;
}

export class TaskFileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  byteSize!: number;

  @ApiProperty({ nullable: true, type: String })
  driveFileId!: string | null;

  @ApiProperty()
  detail!: string;

  @ApiProperty()
  createdByEmail!: string;

  @ApiProperty()
  createdAt!: string;
}

export class TaskHistoryDto {
  @ApiProperty()
  actorEmail!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty()
  createdAt!: string;
}

export class TaskDetailDto extends TaskDto {
  @ApiProperty({ type: [TaskCommentDto] })
  comments!: TaskCommentDto[];

  @ApiProperty({ type: [TaskFileDto] })
  files!: TaskFileDto[];

  @ApiProperty({ type: [TaskHistoryDto] })
  history!: TaskHistoryDto[];
}

export class TaskStageCountsDto {
  @ApiProperty()
  draft!: number;

  @ApiProperty()
  assigned!: number;

  @ApiProperty()
  in_progress!: number;

  @ApiProperty()
  submitted_rm_qc!: number;

  @ApiProperty()
  rm_approved!: number;

  @ApiProperty()
  submitted_admin_qc!: number;

  @ApiProperty()
  admin_approved!: number;

  @ApiProperty()
  ready_to_publish!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  changes_requested!: number;
}

export class TaskPageDto {
  @ApiProperty({ type: [TaskDto] })
  items!: TaskDto[];

  @ApiProperty({ type: TaskStageCountsDto })
  stages!: TaskStageCountsDto;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}
