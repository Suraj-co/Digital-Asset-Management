import { Injectable } from '@nestjs/common';
import { CompaniesService } from '../access/companies.service.js';
import { assetVisibility, taskVisibility } from '../access/portal-scope.js';
import { Prisma } from '../generated/prisma/client.js';
import { payrollTotal } from '../payroll/payroll-total.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WORKFLOW_STAGES, type DashboardDto } from './dashboard.types.js';

type Stage = (typeof WORKFLOW_STAGES)[number];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  async get(userId: string, companyId: string): Promise<DashboardDto> {
    const company = await this.companies.requireMember(userId, companyId);
    const roles = await this.rolesFor(userId, companyId);
    const memberships = roles.map((role) => ({
      companyId,
      role: role as 'creator' | 'rm' | 'admin',
    }));
    const assetWhere = assetVisibility(userId, memberships, companyId);
    const taskWhere = taskVisibility(userId, memberships, companyId);
    const timeWhere: Prisma.TimeEntryWhereInput = roles.includes('admin')
      ? { companyId }
      : { companyId, userId };
    const scope = roles.includes('admin') ? 'company' : roles.includes('rm') ? 'review' : 'own';

    const [assetStages, assetStates, publications, taskStatuses, timeStatuses, minutes, accepted] =
      await Promise.all([
        this.prisma.asset.groupBy({
          by: ['workflowStage'],
          where: assetWhere,
          _count: { _all: true },
        }),
        this.prisma.asset.groupBy({
          by: ['state'],
          where: assetWhere,
          _count: { _all: true },
        }),
        this.prisma.asset.groupBy({
          by: ['publication'],
          where: assetWhere,
          _count: { _all: true },
        }),
        this.prisma.task.groupBy({
          by: ['status'],
          where: taskWhere,
          _count: { _all: true },
        }),
        this.prisma.timeEntry.groupBy({
          by: ['status'],
          where: timeWhere,
          _count: { _all: true },
        }),
        this.prisma.timeEntry.aggregate({
          where: timeWhere,
          _sum: { minutes: true },
        }),
        this.prisma.timeEntry.aggregate({
          where: { ...timeWhere, status: 'accepted' },
          _sum: { minutes: true },
        }),
      ]);

    const byStage = emptyStages();
    let assetTotal = 0;
    for (const row of assetStages) {
      byStage[row.workflowStage] = row._count._all;
      assetTotal += row._count._all;
    }

    const publicationReady = namedCount(publications, (row) => row.publication, 'ready');
    return {
      companyId: company.id,
      companyCode: company.code,
      scope,
      assets: {
        total: assetTotal,
        uploadFailed: namedCount(assetStates, (row) => row.state, 'upload_failed'),
        publicationNotStarted: namedCount(publications, (row) => row.publication, 'not_started'),
        publicationNotRun: namedCount(publications, (row) => row.publication, 'not_run'),
        publicationReady,
        byStage,
      },
      queues: {
        drafts: byStage.draft,
        rmReview: byStage.scope_analysis + byStage.rm_qc + byStage.rm_approval,
        changesRequested: byStage.changes_requested,
        adminReview: Math.max(0, byStage.admin_qc + byStage.admin_approval - publicationReady),
        readyToPublish: publicationReady,
      },
      tasks: {
        open: namedCount(taskStatuses, (row) => row.status, 'open'),
        done: namedCount(taskStatuses, (row) => row.status, 'done'),
      },
      time: {
        open: namedCount(timeStatuses, (row) => row.status, 'open'),
        submitted: namedCount(timeStatuses, (row) => row.status, 'submitted'),
        accepted: namedCount(timeStatuses, (row) => row.status, 'accepted'),
        returned: namedCount(timeStatuses, (row) => row.status, 'returned'),
        minutes: minutes._sum.minutes ?? 0,
      },
      payroll: payrollTotal(
        accepted._sum.minutes ?? 0,
        company.hourlyRateMinor,
        company.currency,
      ),
    };
  }

  private async rolesFor(userId: string, companyId: string): Promise<string[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId, companyId },
      select: { role: true },
    });
    return rows.map((row) => row.role);
  }
}

function emptyStages(): Record<Stage, number> {
  return {
    draft: 0,
    scope_analysis: 0,
    rm_qc: 0,
    rm_approval: 0,
    admin_qc: 0,
    admin_approval: 0,
    changes_requested: 0,
  };
}

function namedCount<Row extends { _count: { _all: number } }>(
  rows: Row[],
  read: (row: Row) => string,
  key: string,
): number {
  return rows.find((row) => read(row) === key)?._count._all ?? 0;
}
