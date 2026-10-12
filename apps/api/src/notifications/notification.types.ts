import { ApiProperty } from '@nestjs/swagger';

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SAPL' })
  companyCode!: string;

  @ApiProperty({
    enum: [
      'task_assigned',
      'task_updated',
      'time_returned',
      'asset_rejected',
      'asset_submitted',
      'asset_approved',
    ],
  })
  kind!:
    | 'task_assigned'
    | 'task_updated'
    | 'time_returned'
    | 'asset_rejected'
    | 'asset_submitted'
    | 'asset_approved';

  @ApiProperty()
  body!: string;

  @ApiProperty({ example: '/tasks' })
  href!: string;

  @ApiProperty({ nullable: true, type: String })
  readAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true, type: Object })
  email!: {
    status: 'pending' | 'queued' | 'held' | 'sent' | 'failed';
    toAddress: string;
    detail: string;
  } | null;
}

export class NotificationPageDto {
  @ApiProperty({ type: [NotificationDto] })
  items!: NotificationDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  unread!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;
}
