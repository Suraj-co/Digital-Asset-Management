import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { DashboardQueryDto } from './dashboard-query.dto.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardDto } from './dashboard.types.js';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(SessionGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Count stored rows for one company',
    description:
      'A creator sees counts of their own rows. An RM or admin sees every row in the company. Minutes are the sum of stored minutes. Payroll is accepted minutes times the company hourly rate. No file is stored.',
  })
  @ApiOkResponse({ type: DashboardDto })
  get(
    @Req() req: AuthenticatedRequest,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardDto> {
    return this.dashboard.get(req.principal.id, query.companyId);
  }
}
