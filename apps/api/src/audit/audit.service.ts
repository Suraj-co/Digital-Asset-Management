import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleWorkspaceService } from '../storage/google-workspace.js';
import type { AuditActionName, AuditEventDto } from './audit.types.js';

const eventInclude = {
  company: { select: { code: true } },
  actor: { select: { email: true } },
};

type EventRow = Prisma.AuditEventGetPayload<{ include: typeof eventInclude }>;
type Writer = Pick<Prisma.TransactionClient, 'auditEvent'>;

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleWorkspaceService,
  ) {}

  async emailOf(userId: string): Promise<string> {
    const actor = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    return actor.email;
  }

  async write(
    db: Writer,
    input: {
      companyId: string;
      actorId: string;
      action: AuditActionName;
      summary: string;
      subjectType: string;
      subjectId: string;
    },
  ): Promise<void> {
    await db.auditEvent.create({
      data: {
        companyId: input.companyId,
        actorId: input.actorId,
        action: input.action,
        summary: input.summary,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
    });
    if (this.google.sheetsReady()) {
      void this.recordSheet(input);
    }
  }

  private async recordSheet(input: {
    companyId: string;
    actorId: string;
    action: AuditActionName;
    summary: string;
    subjectType: string;
    subjectId: string;
  }): Promise<void> {
    const [actor, company] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: input.actorId },
        select: { email: true },
      }),
      this.prisma.company.findUnique({
        where: { id: input.companyId },
        select: { code: true },
      }),
    ]);
    await this.google.appendHistory({
      actor: actor?.email ?? input.actorId,
      action: input.action,
      company: company?.code ?? input.companyId,
      path: '',
      name: input.subjectType,
      driveId: input.subjectId,
      detail: input.summary,
    });
  }

  async list(
    companyId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: AuditEventDto[]; total: number }> {
    const where = { companyId };
    const [total, rows] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: eventInclude,
      }),
    ]);
    return { total, items: rows.map((row) => this.toDto(row)) };
  }

  private toDto(row: EventRow): AuditEventDto {
    return {
      id: row.id,
      companyCode: row.company.code,
      actorEmail: row.actor.email,
      action: row.action,
      summary: row.summary,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
