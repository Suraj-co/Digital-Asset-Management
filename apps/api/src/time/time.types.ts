import { ApiProperty } from '@nestjs/swagger';

const ACTIONS = ['submit', 'accept', 'return'] as const;

export class TimeEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ example: 'SAPL' })
  companyCode!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  userEmail!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  taskId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  taskTitle!: string | null;

  @ApiProperty({ example: '2026-10-10' })
  workDate!: string;

  @ApiProperty({ example: 90 })
  minutes!: number;

  @ApiProperty()
  note!: string;

  @ApiProperty({ enum: ['open', 'submitted', 'accepted', 'returned'] })
  status!: 'open' | 'submitted' | 'accepted' | 'returned';

  @ApiProperty({ nullable: true, type: String })
  reviewReason!: string | null;

  @ApiProperty({ enum: ACTIONS, isArray: true })
  actions!: (typeof ACTIONS)[number][];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class TimeEntryPageDto {
  @ApiProperty({ type: [TimeEntryDto] })
  items!: TimeEntryDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}
