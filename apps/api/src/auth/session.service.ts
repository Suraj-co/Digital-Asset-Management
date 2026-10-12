import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  hashSessionToken,
  newSessionToken,
  SESSION_TTL_MS,
} from './session-token.js';
import type { SessionUserDto } from './session.types.js';

type PublicUser = SessionUserDto;

@Injectable()
export class SessionService {
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; expiresAt: Date; user: PublicUser }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const stored = user?.passwordHash ?? (await this.placeholderHash());
    const matches = await verifyPassword(password, stored);
    if (!user || !matches || user.status !== 'active') {
      throw new UnauthorizedException('The email or password is incorrect.');
    }

    await this.prisma.session.deleteMany({ where: { userId: user.id } });
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
      },
    });
    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
    };
  }

  async current(
    token: string | null,
  ): Promise<{ user: PublicUser; expiresAt: Date }> {
    if (!token) {
      throw new UnauthorizedException('Sign in is required.');
    }
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: true },
    });
    const expired =
      session !== null && session.expiresAt.getTime() <= Date.now();
    const disabled = session !== null && session.user.status !== 'active';
    if (!session || expired || disabled) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Sign in is required.');
    }
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        status: session.user.status,
      },
      expiresAt: session.expiresAt,
    };
  }

  async logout(token: string | null): Promise<void> {
    if (!token) {
      return;
    }
    await this.prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  private placeholderHash(): Promise<string> {
    this.dummyHash ??= hashPassword('not-a-credential');
    return this.dummyHash;
  }
}
