import { Controller, Get, HttpStatus, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { correlationIdFrom } from '../http/request-context.js';
import { APP_NAME, APP_VERSION } from '../version.js';
import { HealthService } from './health.service.js';
import { HealthReportDto, LivenessDto } from './health.types.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Process and dependency report',
    description:
      'Always returns HTTP 200 when the API process can answer. A down database is reported in the body as status "degraded". Use /health/ready for an orchestrator probe that should fail when PostgreSQL is down.',
  })
  @ApiOkResponse({ type: HealthReportDto })
  report(@Req() req: Request): Promise<HealthReportDto> {
    return this.healthService.check(correlationIdFrom(req));
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Does not contact PostgreSQL.',
  })
  @ApiOkResponse({ type: LivenessDto })
  live(@Req() req?: Request): LivenessDto {
    return {
      status: 'ok',
      service: APP_NAME,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      correlationId: correlationIdFrom(req),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Returns HTTP 200 when PostgreSQL answers SELECT 1, and HTTP 503 otherwise.',
  })
  @ApiOkResponse({ type: HealthReportDto })
  async ready(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthReportDto> {
    const report = await this.healthService.check(correlationIdFrom(req));
    res.status(
      report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );
    return report;
  }
}
