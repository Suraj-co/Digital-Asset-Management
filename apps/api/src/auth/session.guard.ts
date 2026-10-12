import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from './session.service.js';
import { readCookie, SESSION_COOKIE } from './session-token.js';
import type { SessionUserDto } from './session.types.js';

export type AuthenticatedRequest = Request & { principal: SessionUserDto };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const current = await this.sessions.current(
      readCookie(request.header('cookie'), SESSION_COOKIE),
    );
    request.principal = current.user;
    return true;
  }
}
