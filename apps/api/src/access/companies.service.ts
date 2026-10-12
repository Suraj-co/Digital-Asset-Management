import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { formatMinor, type PayCurrency } from '../payroll/payroll-total.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CompanyDto, MembershipDto, MembershipRoleName } from './access.types.js';

type MembershipRow = {
  id: string;
  role: MembershipRoleName;
  company: { id: string; code: string; name: string; active: boolean };
};

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AuditService))
    private readonly audit: AuditService,
  ) {}

  async listForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: CompanyDto[]; total: number }> {
    const grouped = await this.companiesFor(userId);
    return { items: grouped.slice(offset, offset + limit), total: grouped.length };
  }

  async getForUser(userId: string, companyId: string): Promise<CompanyDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('No company has that id.');
    }
    const memberships = await this.prisma.membership.findMany({
      where: { userId, companyId },
      orderBy: { role: 'asc' },
    });
    if (memberships.length === 0) {
      throw new ForbiddenException('You do not have access to this company.');
    }
    return {
      id: company.id,
      code: company.code,
      name: company.name,
      active: company.active,
      roles: memberships.map((membership) => membership.role),
    };
  }

  async grant(
    actorId: string,
    companyId: string,
    email: string,
    role: MembershipRoleName,
  ): Promise<MembershipDto> {
    const company = await this.requireAdmin(actorId, companyId);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('No user has that email.');
    }
    const actorEmail = await this.audit.emailOf(actorId);
    try {
      const membership = await this.prisma.$transaction(async (tx) => {
        const row = await tx.membership.create({
          data: { userId: user.id, companyId: company.id, role },
        });
        await this.audit.write(tx, {
          companyId: company.id,
          actorId,
          action: 'membership_granted',
          summary: `${actorEmail} granted ${role} to ${user.email}.`,
          subjectType: 'membership',
          subjectId: row.id,
        });
        return row;
      });
      return {
        id: membership.id,
        userId: user.id,
        email: user.email,
        companyId: company.id,
        companyCode: company.code,
        role,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('That membership already exists.');
      }
      throw error;
    }
  }

  async revoke(
    actorId: string,
    companyId: string,
    membershipId: string,
  ): Promise<void> {
    await this.requireAdmin(actorId, companyId);
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, companyId },
      include: { user: { select: { email: true } } },
    });
    if (!membership) {
      throw new NotFoundException('No membership has that id.');
    }
    if (membership.role === 'admin') {
      await this.assertAnotherActiveAdmin(companyId, membership.userId);
    }
    const actorEmail = await this.audit.emailOf(actorId);
    await this.prisma.$transaction(async (tx) => {
      await tx.membership.delete({ where: { id: membership.id } });
      await this.audit.write(tx, {
        companyId,
        actorId,
        action: 'membership_revoked',
        summary: `${actorEmail} removed ${membership.role} from ${membership.user.email}.`,
        subjectType: 'membership',
        subjectId: membership.id,
      });
    });
  }

  private async companiesFor(userId: string): Promise<CompanyDto[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        company: {
          select: { id: true, code: true, name: true, active: true },
        },
      },
      orderBy: [{ company: { code: 'asc' } }, { role: 'asc' }],
    });
    const grouped = new Map<string, CompanyDto>();
    for (const row of rows as MembershipRow[]) {
      const current = grouped.get(row.company.id);
      if (current) {
        current.roles.push(row.role);
      } else {
        grouped.set(row.company.id, {
          id: row.company.id,
          code: row.company.code,
          name: row.company.name,
          active: row.company.active,
          roles: [row.role],
        });
      }
    }
    return [...grouped.values()];
  }

  async requireMember(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('No company has that id.');
    }
    const membership = await this.prisma.membership.findFirst({
      where: { userId, companyId },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this company.');
    }
    return company;
  }

  async setPayRate(
    actorId: string,
    companyId: string,
    hourlyRateMinor: number,
    currency: PayCurrency,
  ): Promise<{
    companyId: string;
    companyCode: string;
    hourlyRateMinor: number;
    currency: PayCurrency;
  }> {
    const company = await this.requireAdmin(actorId, companyId);
    const actorEmail = await this.audit.emailOf(actorId);
    const amount = formatMinor(hourlyRateMinor, currency);
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { hourlyRateMinor, currency },
      });
      await this.audit.write(tx, {
        companyId,
        actorId,
        action: 'pay_rate_set',
        summary: `${actorEmail} set the ${company.code} hourly rate to ${amount}. The payroll total uses accepted minutes only.`,
        subjectType: 'company',
        subjectId: companyId,
      });
    });
    return {
      companyId: company.id,
      companyCode: company.code,
      hourlyRateMinor,
      currency,
    };
  }

  async requireAdmin(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('No company has that id.');
    }
    const admin = await this.prisma.membership.findFirst({
      where: { userId, companyId, role: 'admin' },
    });
    if (!admin) {
      throw new ForbiddenException(
        'You do not have access to manage this company.',
      );
    }
    return company;
  }

  private async assertAnotherActiveAdmin(
    companyId: string,
    exceptUserId: string,
  ): Promise<void> {
    const others = await this.prisma.membership.count({
      where: {
        companyId,
        role: 'admin',
        userId: { not: exceptUserId },
        user: { status: 'active' },
      },
    });
    if (others === 0) {
      throw new ConflictException('This company needs an active admin.');
    }
  }
}
