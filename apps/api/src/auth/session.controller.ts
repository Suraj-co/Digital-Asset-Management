import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { loadEnv } from '../config/env.js';
import { CreateSessionDto } from './create-session.dto.js';
import { SessionService } from './session.service.js';
import {
  readCookie,
  SESSION_COOKIE,
  sessionCookieOptions,
} from './session-token.js';
import { SessionDto } from './session.types.js';

@ApiTags('session')
@Controller('session')
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a server session',
    description:
      'Sets an httpOnly cookie. The token is not in the JSON body. Unknown, wrong, and disabled accounts all receive the same 401.',
  })
  @ApiOkResponse({ type: SessionDto })
  async create(
    @Body() body: CreateSessionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionDto> {
    const session = await this.sessions.login(body.email, body.password);
    const secure = loadEnv().nodeEnv === 'production';
    res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions(secure));
    return {
      user: session.user,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Read the current session',
    description:
      'Requires the session cookie. A disabled account or an expired session is rejected and removed.',
  })
  @ApiOkResponse({ type: SessionDto })
  async current(@Req() req: Request): Promise<SessionDto> {
    const session = await this.sessions.current(
      readCookie(req.header('cookie'), SESSION_COOKIE),
    );
    return {
      user: session.user,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: 'End the current session',
    description: 'Clears the cookie. Missing cookies are still cleared.',
  })
  async remove(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.logout(readCookie(req.header('cookie'), SESSION_COOKIE));
    const secure = loadEnv().nodeEnv === 'production';
    res.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
    });
  }
}
