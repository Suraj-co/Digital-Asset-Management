import { ApiProperty } from '@nestjs/swagger';

export class SessionUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'person@example.com' })
  email!: string;

  @ApiProperty({ enum: ['active', 'disabled'] })
  status!: 'active' | 'disabled';
}

export class SessionDto {
  @ApiProperty({ type: SessionUserDto })
  user!: SessionUserDto;

  @ApiProperty({ example: '2026-10-10T17:40:00.000Z' })
  expiresAt!: string;
}
