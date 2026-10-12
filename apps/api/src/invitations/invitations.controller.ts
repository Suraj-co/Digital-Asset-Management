import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard.js';
import { AcceptInvitationDto } from './accept-invitation.dto.js';
import { InviteCreatorDto } from './invite-creator.dto.js';
import {
  AcceptedInvitationDto,
  CreatorInvitationDto,
  CreatorInvitationListDto,
} from './invitation.types.js';
import { InvitationsService } from './invitations.service.js';

@ApiTags('invitations')
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get('companies/:companyId/creator-invitations')
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'List open creator invitations',
    description:
      'An RM or an admin sees invitations that have not been accepted, including the latest mail delivery status.',
  })
  @ApiOkResponse({ type: CreatorInvitationListDto })
  list(
    @Req() req: AuthenticatedRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<CreatorInvitationListDto> {
    return this.invitations.list(req.principal.id, companyId);
  }

  @Post('companies/:companyId/creator-invitations')
  @HttpCode(201)
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Invite a creator by name, email, and initial password',
    description:
      'An RM or an admin of the company can invite. The password is stored as a hash. The email contains the login address and a setup link, and it does not contain the password. The response reports the mail delivery status after the server is contacted.',
  })
  @ApiOkResponse({ type: CreatorInvitationDto })
  invite(
    @Req() req: AuthenticatedRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() body: InviteCreatorDto,
  ): Promise<CreatorInvitationDto> {
    return this.invitations.invite(req.principal.id, companyId, {
      name: body.name,
      email: body.email,
      password: body.password,
    });
  }

  @Post('companies/:companyId/creator-invitations/:invitationId/resend')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Resend an open creator invitation',
    description:
      'Replaces the setup link and contacts the mail server again. A used invitation is rejected. This does not create a second account.',
  })
  @ApiOkResponse({ type: CreatorInvitationDto })
  resend(
    @Req() req: AuthenticatedRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<CreatorInvitationDto> {
    return this.invitations.resend(req.principal.id, companyId, invitationId);
  }

  @Post('invitations/accept')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Set a password from an invitation link',
    description:
      'The token is single use. An expired or unknown token is rejected. The password is stored as a hash.',
  })
  @ApiOkResponse({ type: AcceptedInvitationDto })
  accept(@Body() body: AcceptInvitationDto): Promise<AcceptedInvitationDto> {
    return this.invitations.accept(body.token, body.password);
  }
}
