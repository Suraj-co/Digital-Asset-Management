import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { PageQueryDto } from '../http/page-query.dto.js';
import { NotificationDto, NotificationPageDto } from './notification.types.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List notices addressed to the caller',
    description:
      'The list is only the signed-in person. Unread is the count of their unread rows. Each row can include an email copy. That copy is sent only when a mail server is configured.',
  })
  @ApiOkResponse({ type: NotificationPageDto })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: PageQueryDto,
  ): Promise<NotificationPageDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = await this.notifications.list(req.principal.id, limit, offset);
    return { ...page, limit, offset };
  }

  @Post(':notificationId/read')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mark one of the caller’s notices read',
    description: 'Another person’s id is 404. Marking a read notice again keeps the original time.',
  })
  @ApiOkResponse({ type: NotificationDto })
  markRead(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(req.principal.id, notificationId);
  }
}
