import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard.js';
import { PageQueryDto } from '../http/page-query.dto.js';
import { UpdateUserDto } from './update-user.dto.js';
import { ManagedUserDto, UserPageDto } from './access.types.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List users in companies the caller administers',
    description:
      'A caller who is not an admin receives 403. Memberships outside those companies are omitted.',
  })
  @ApiOkResponse({ type: UserPageDto })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: PageQueryDto,
  ): Promise<UserPageDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = await this.users.listForAdmin(req.principal.id, limit, offset);
    return { ...page, limit, offset };
  }

  @Patch(':userId')
  @ApiOperation({
    summary: 'Enable or disable a user in companies the caller administers',
    description:
      'The caller must administer every company the user belongs to. The caller cannot disable their own account.',
  })
  @ApiOkResponse({ type: ManagedUserDto })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: UpdateUserDto,
  ): Promise<ManagedUserDto> {
    return this.users.updateStatus(req.principal.id, userId, body.status);
  }
}
