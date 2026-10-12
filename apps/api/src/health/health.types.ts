import { ApiProperty } from '@nestjs/swagger';

export class ApiCheckDto {
  @ApiProperty({ example: 'up' })
  status!: 'up';
}

export class DatabaseCheckDto {
  @ApiProperty({ enum: ['up', 'down'] })
  status!: 'up' | 'down';

  @ApiProperty({ type: Number, nullable: true, example: 4 })
  latencyMs!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Safe failure category. Null when the database check succeeded. Raw driver errors are not returned.',
  })
  category!: string | null;
}

export class RedisCheckDto {
  @ApiProperty({ enum: ['up', 'down', 'not_configured'] })
  status!: 'up' | 'down' | 'not_configured';

  @ApiProperty({ type: Number, nullable: true })
  latencyMs!: number | null;
}

export class HealthChecksDto {
  @ApiProperty({ type: ApiCheckDto })
  api!: ApiCheckDto;

  @ApiProperty({ type: DatabaseCheckDto })
  database!: DatabaseCheckDto;

  @ApiProperty({ type: RedisCheckDto })
  redis!: RedisCheckDto;
}

export class HealthReportDto {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({ example: 'aaradhya-dam-api' })
  service!: string;

  @ApiProperty({ example: '0.1.0' })
  version!: string;

  @ApiProperty({ example: '2026-10-10T04:41:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 'trace-42' })
  correlationId!: string;

  @ApiProperty({ type: HealthChecksDto })
  checks!: HealthChecksDto;
}

export class LivenessDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'aaradhya-dam-api' })
  service!: string;

  @ApiProperty({ example: '0.1.0' })
  version!: string;

  @ApiProperty({ example: '2026-10-10T04:41:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 'trace-42' })
  correlationId!: string;
}

export type DatabaseCheck = {
  status: 'up' | 'down';
  latencyMs: number | null;
  category: string | null;
};

export type HealthReport = {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  correlationId: string;
  checks: {
    api: { status: 'up' };
    database: DatabaseCheck;
    redis: {
      status: 'up' | 'down' | 'not_configured';
      latencyMs: number | null;
    };
  };
};
