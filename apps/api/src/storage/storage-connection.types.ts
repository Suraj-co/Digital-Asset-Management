import { ApiProperty } from '@nestjs/swagger';
import type { DriveSettingName } from './drive-settings.js';

export class StorageConnectionDto {
  @ApiProperty({
    enum: ['not_configured', 'configured'],
    description:
      'configured means the client id and secret are present. It does not mean Google accepted them.',
  })
  status!: 'not_configured' | 'configured';

  @ApiProperty({ example: 'google_drive' })
  provider!: 'google_drive';

  @ApiProperty({
    type: [String],
    example: [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'GOOGLE_DRIVE_ID',
    ],
  })
  missing!: DriveSettingName[];

  @ApiProperty({
    enum: ['not_run'],
    description: 'This route does not call the Drive API.',
  })
  liveCheck!: 'not_run';

  @ApiProperty()
  detail!: string;

  @ApiProperty({ example: '2026-10-10T05:40:00.000Z' })
  timestamp!: string;

  @ApiProperty()
  correlationId!: string;
}
