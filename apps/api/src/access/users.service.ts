import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ManagedUserDto, MembershipRoleName } from './access.types.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AuditService))
    private readonly audit: AuditService,
  ) {}

  async listForAdmin(
    actorId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: ManagedUserDto[]; total: number }> {
    const companyIds = await this.adminCompanyIds(actorId);
    if (companyIds.length === 0) {
      throw new ForbiddenException('You do not have access to manage users.');
    }
    const where = {
      memberships: { some: { companyId: { in: companyIds } } },
    };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { email: 'asc' },
        include: {
          memberships: {
            where: { companyId: { in: companyIds } },
            include: { company: { select: { code: true } } },
            orderBy: [{ company: { code: 'asc' } }, { role: 'asc' }],
          },
        },
      }),
    ]);
    return {
      total,
      items: users.map((user) => ({
        id: user.id,
        email: user.email,
        status: user.status,
        memberships: user.memberships.map((membership) => ({
          id: membership.id,
          companyId: membership.companyId,
          companyCode: membership.company.code,
          role: membership.role as MembershipRoleName,
        })),
      })),
    };
  }

  async updateStatus(
    actorId: string,
    userId: string,
    status: 'active' | 'disabled',
  ): Promise<ManagedUserDto> {
    if (actorId === userId && status === 'disabled') {
      throw new ForbiddenException('You cannot disable your own account.');
    }
    const companyIds = await this.adminCompanyIds(actorId);
    if (companyIds.length === 0) {
      throw new ForbiddenException('You do not have access to manage users.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { select: { companyId: true, role: true } } },
    });
    if (!user) {
      throw new NotFoundException('No user has that id.');
    }
    const outside = user.memberships.some(
      (membership) => !companyIds.includes(membership.companyId),
    );
    const inside = user.memberships.some((membership) =>
      companyIds.includes(membership.companyId),
    );
    if (!inside || outside) {
      throw new ForbiddenException('You do not have access to this user.');
    }
    if (status === 'disabled') {
      const adminCompanyIds = user.memberships
        .filter((membership) => membership.role === 'admin')
        .map((membership) => membership.companyId);
      for (const companyId of adminCompanyIds) {
        const others = await this.prisma.membership.count({
          where: {
            companyId,
            role: 'admin',
            userId: { not: userId },
            user: { status: 'active' },
          },
        });
        if (others === 0) {
          throw new ConflictException('This company needs an active admin.');
        }
      }
    }
    const actorEmail = await this.audit.emailOf(actorId);
    const companyIdsForEvent = [
      ...new Set(
        user.memberships
          .filter((membership) => companyIds.includes(membership.companyId))
          .map((membership) => membership.companyId),
      ),
    ];
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id: userId },
        data: { status },
        include: {
          memberships: {
            where: { companyId: { in: companyIds } },
            include: { company: { select: { code: true } } },
            orderBy: [{ company: { code: 'asc' } }, { role: 'asc' }],
          },
        },
      });
      for (const companyId of companyIdsForEvent) {
        await this.audit.write(tx, {
          companyId,
          actorId,
          action: status === 'disabled' ? 'account_disabled' : 'account_enabled',
          summary: `${actorEmail} ${status === 'disabled' ? 'disabled' : 'enabled'} ${user.email}.`,
          subjectType: 'user',
          subjectId: user.id,
        });
      }
      return row;
    });
    return {
      id: updated.id,
      email: updated.email,
      status: updated.status,
      memberships: updated.memberships.map((membership) => ({
        id: membership.id,
        companyId: membership.companyId,
        companyCode: membership.company.code,
        role: membership.role as MembershipRoleName,
      })),
    };
  }

  private async adminCompanyIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId, role: 'admin' },
      select: { companyId: true },
    });
    return rows.map((row) => row.companyId);
  }
}
