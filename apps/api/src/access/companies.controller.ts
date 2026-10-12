import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard.js';
import { PageQueryDto } from '../http/page-query.dto.js';
import { CompaniesService } from './companies.service.js';
import { GrantMembershipDto } from './grant-membership.dto.js';
import { SetPayRateDto } from './set-pay-rate.dto.js';
import { CompanyDto, CompanyPageDto, MembershipDto } from './access.types.js';

@ApiTags('companies')
@Controller('companies')
@UseGuards(SessionGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @ApiOperation({
    summary: 'List companies the caller belongs to',
    description:
      'Other companies are omitted. Requesting one of those ids directly returns 403.',
  })
  @ApiOkResponse({ type: CompanyPageDto })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: PageQueryDto,
  ): Promise<CompanyPageDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = await this.companies.listForUser(req.principal.id, limit, offset);
    return { ...page, limit, offset };
  }

  @Get(':companyId')
  @ApiOperation({
    summary: 'Read one company the caller belongs to',
    description:
      'A company id outside the caller’s memberships is 403. An unknown id is 404.',
  })
  @ApiOkResponse({ type: CompanyDto })
  get(
    @Req() req: AuthenticatedRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<CompanyDto> {
    return this.companies.getForUser(req.principal.id, companyId);
  }

  @Patch(':companyId/pay-rate')
  @ApiOperation({
    summary: 'Set the company hourly rate used for the payroll total',
    description:
      'An admin of that company sets the rate in minor units per hour. The payroll total is accepted minutes times this rate.',
  })
  setPayRate(
    @Req() req: AuthenticatedRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() body: SetPayRateDto,
  ) {
    return this.companies.setPayRate(
      req.principal.id,
      companyId,
      body.hourlyRateMinor,
      body.currency,
    );
  }

  @Post(':companyId/memberships')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Grant a membership in a company the caller administers',
  })
  @ApiOkResponse({ type: MembershipDto })
  grant(
    @Req() req: AuthenticatedRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() body: GrantMembershipDto,
  ): Promise<MembershipDto> {
    return this.companies.grant(
      req.principal.id,
      companyId,
      body.email,
      body.role,
    );
  }

  @Delete(':companyId/memberships/:membershipId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Remove a membership in a company the caller administers',
    description: 'The last active admin membership of a company is kept.',
  })
  revoke(
    @Req() req: AuthenticatedRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ): Promise<void> {
    return this.companies.revoke(req.principal.id, companyId, membershipId);
  }
}
