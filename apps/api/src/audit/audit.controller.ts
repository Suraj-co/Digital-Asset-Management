import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from '../access/companies.service.js';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { AuditQueryDto } from './audit-query.dto.js';
import { AuditPageDto } from './audit.types.js';
import { AuditService } from './audit.service.js';

@ApiTags('audit')
@Controller('audit-events')
@UseGuards(SessionGuard)
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly companies: CompaniesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List stored sentences for one company',
    description:
      'An admin of that company can read the log. A creator or RM receives 403. The list is append-only. Earlier work is not copied in. No file bytes are returned.',
  })
  @ApiOkResponse({ type: AuditPageDto })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: AuditQueryDto,
  ): Promise<AuditPageDto> {
    await this.companies.requireAdmin(req.principal.id, query.companyId);
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = await this.audit.list(query.companyId, limit, offset);
    return { ...page, limit, offset };
  }
}
