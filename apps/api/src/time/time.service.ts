import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompaniesService } from '../access/companies.service.js';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  noticeSentence,
  NotificationsService,
} from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TimeEntryDto } from './time.types.js';

const entryInclude = {
  company: { select: { code: true } },
  user: { select: { email: true } },
  task: { select: { id: true, title: true, companyId: true } },
};

type EntryRow = Prisma.TimeEntryGetPayload<{ include: typeof entryInclude }>;
type ReviewAction = 'submit' | 'accept' | 'return';

@Injectable()
export class TimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async list(
    userId: string,
    companyId: string | undefined,
    limit: number,
    offset: number,
  ): Promise<{ items: TimeEntryDto[]; total: number }> {
    const where = await this.visibleWhere(userId, companyId);
    if (!where) {
      return { items: [], total: 0 };
    }
    const [total, rows, roles] = await Promise.all([
      this.prisma.timeEntry.count({ where }),
      this.prisma.timeEntry.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
        include: entryInclude,
      }),
      this.rolesByCompany(userId),
    ]);
    return { total, items: rows.map((row) => this.toDto(row, userId, roles)) };
  }

  async get(userId: string, entryId: string): Promise<TimeEntryDto> {
    const entry = await this.findEntry(entryId);
    const roles = await this.rolesFor(userId, entry.companyId);
    this.assertCanRead(userId, entry, roles);
    return this.toDto(entry, userId, new Map([[entry.companyId, roles]]));
  }

  async create(
    userId: string,
    input: { companyId: string; workDate: string; minutes: number; note?: string; taskId?: string },
  ): Promise<TimeEntryDto> {
    await this.companies.requireMember(userId, input.companyId);
    const workDate = this.parseWorkDate(input.workDate);
    const taskId = await this.taskInCompany(userId, input.companyId, input.taskId);
    const actorEmail = await this.audit.emailOf(userId);
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.timeEntry.create({
        data: {
          companyId: input.companyId,
          userId,
          taskId,
          workDate,
          minutes: input.minutes,
          note: input.note ?? '',
          status: 'open',
        },
        include: entryInclude,
      });
      await this.audit.write(tx, {
        companyId: input.companyId,
        actorId: userId,
        action: 'time_recorded',
        summary: `${actorEmail} recorded ${input.minutes} minutes.`,
        subjectType: 'time_entry',
        subjectId: row.id,
      });
      return row;
    });
    const roles = await this.rolesFor(userId, input.companyId);
    return this.toDto(created, userId, new Map([[input.companyId, roles]]));
  }

  async update(
    userId: string,
    entryId: string,
    input: { workDate?: string; minutes?: number; note?: string; taskId?: string | null },
  ): Promise<TimeEntryDto> {
    const entry = await this.findEntry(entryId);
    if (entry.userId !== userId) {
      throw new ForbiddenException('You cannot change another person\'s time.');
    }
    if (entry.status !== 'open' && entry.status !== 'returned') {
      throw new ConflictException('This time entry is not open for changes.');
    }
    const workDate = input.workDate === undefined ? undefined : this.parseWorkDate(input.workDate);
    const taskId =
      input.taskId === undefined
        ? undefined
        : await this.taskInCompany(userId, entry.companyId, input.taskId);
    const actorEmail = await this.audit.emailOf(userId);
    const minutes = input.minutes ?? entry.minutes;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.timeEntry.update({
        where: { id: entryId },
        data: {
          workDate,
          minutes: input.minutes,
          note: input.note,
          taskId,
        },
        include: entryInclude,
      });
      await this.audit.write(tx, {
        companyId: entry.companyId,
        actorId: userId,
        action: 'time_changed',
        summary: `${actorEmail} changed a time entry to ${minutes} minutes.`,
        subjectType: 'time_entry',
        subjectId: entry.id,
      });
      return row;
    });
    const roles = await this.rolesFor(userId, entry.companyId);
    return this.toDto(updated, userId, new Map([[entry.companyId, roles]]));
  }

  async review(
    userId: string,
    entryId: string,
    input: { action: ReviewAction; reason: string | null },
  ): Promise<TimeEntryDto> {
    const entry = await this.findEntry(entryId);
    const roles = await this.rolesFor(userId, entry.companyId);
    if (roles.length === 0) {
      throw new ForbiddenException('You do not have access to this company.');
    }
    if (input.action !== 'return' && input.reason) {
      throw new BadRequestException('A reason is only recorded when time is returned.');
    }
    if (input.action === 'submit') {
      if (entry.userId !== userId) {
        throw new ForbiddenException('You cannot submit another person\'s time.');
      }
      if (entry.status !== 'open' && entry.status !== 'returned') {
        throw new ConflictException('This time entry is not open for changes.');
      }
      const actorEmail = await this.audit.emailOf(userId);
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.timeEntry.update({
          where: { id: entryId },
          data: { status: 'submitted', reviewReason: null, reviewedById: null },
          include: entryInclude,
        });
        await this.audit.write(tx, {
          companyId: entry.companyId,
          actorId: userId,
          action: 'time_submitted',
          summary: `${actorEmail} submitted ${entry.minutes} minutes.`,
          subjectType: 'time_entry',
          subjectId: entry.id,
        });
        return row;
      });
      return this.toDto(updated, userId, new Map([[entry.companyId, roles]]));
    }
    if (!roles.includes('rm') && !roles.includes('admin')) {
      throw new ForbiddenException('You cannot review time.');
    }
    if (entry.status !== 'submitted') {
      throw new ConflictException('This time entry is not waiting for review.');
    }
    if (input.action === 'return' && !input.reason) {
      throw new BadRequestException('Enter a reason for the return.');
    }
    if (input.action === 'accept') {
      const actorEmail = await this.audit.emailOf(userId);
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.timeEntry.update({
          where: { id: entryId },
          data: {
            status: 'accepted',
            reviewReason: null,
            reviewedById: userId,
          },
          include: entryInclude,
        });
        await this.audit.write(tx, {
          companyId: entry.companyId,
          actorId: userId,
          action: 'time_accepted',
          summary: `${actorEmail} accepted ${entry.minutes} minutes.`,
          subjectType: 'time_entry',
          subjectId: entry.id,
        });
        return row;
      });
      return this.toDto(updated, userId, new Map([[entry.companyId, roles]]));
    }
    const actor = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.timeEntry.update({
        where: { id: entryId },
        data: {
          status: 'returned',
          reviewReason: input.reason,
          reviewedById: userId,
        },
        include: entryInclude,
      });
      await this.notifications.write(tx, {
        companyId: entry.companyId,
        recipientId: entry.userId,
        actorId: userId,
        kind: 'time_returned',
        body: `${actor.email} returned ${entry.minutes} minutes: ${noticeSentence(input.reason ?? '')}`,
        href: '/time',
      });
      await this.audit.write(tx, {
        companyId: entry.companyId,
        actorId: userId,
        action: 'time_returned',
        summary: `${actor.email} returned ${entry.minutes} minutes: ${noticeSentence(input.reason ?? '')}`,
        subjectType: 'time_entry',
        subjectId: entry.id,
      });
      return row;
    });
    return this.toDto(updated, userId, new Map([[entry.companyId, roles]]));
  }

  private async visibleWhere(
    userId: string,
    companyId: string | undefined,
  ): Promise<Prisma.TimeEntryWhereInput | null> {
    const roles = await this.rolesByCompany(userId);
    const companyIds = companyId ? [companyId] : [...roles.keys()];
    if (companyId) {
      if (!roles.has(companyId)) {
        await this.companies.requireMember(userId, companyId);
      }
    }
    const reviewIds: string[] = [];
    const ownIds: string[] = [];
    for (const id of companyIds) {
      const companyRoles = roles.get(id) ?? [];
      if (companyRoles.length === 0) {
        continue;
      }
      if (companyRoles.includes('rm') || companyRoles.includes('admin')) {
        reviewIds.push(id);
      } else {
        ownIds.push(id);
      }
    }
    if (reviewIds.length === 0 && ownIds.length === 0) {
      return null;
    }
    return {
      OR: [
        ...(reviewIds.length > 0 ? [{ companyId: { in: reviewIds } }] : []),
        ...(ownIds.length > 0 ? [{ companyId: { in: ownIds }, userId }] : []),
      ],
    };
  }

  private assertCanRead(userId: string, entry: EntryRow, roles: string[]): void {
    if (roles.length === 0) {
      throw new ForbiddenException('You do not have access to this company.');
    }
    const reviewer = roles.includes('rm') || roles.includes('admin');
    if (!reviewer && entry.userId !== userId) {
      throw new ForbiddenException('You cannot read another person\'s time.');
    }
  }

  private async findEntry(entryId: string): Promise<EntryRow> {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id: entryId },
      include: entryInclude,
    });
    if (!entry) {
      throw new NotFoundException('No time entry has that id.');
    }
    return entry;
  }

  private parseWorkDate(value: string): Date {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Use a work date as YYYY-MM-DD.');
    }
    const today = new Date().toISOString().slice(0, 10);
    if (value > today) {
      throw new BadRequestException('Use a work date that is not in the future.');
    }
    return parsed;
  }

  private async taskInCompany(
    userId: string,
    companyId: string,
    taskId: string | null | undefined,
  ): Promise<string | null> {
    if (!taskId) {
      return null;
    }
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, companyId: true },
    });
    if (!task) {
      throw new NotFoundException('No task has that id.');
    }
    if (task.companyId !== companyId) {
      await this.companies.requireMember(userId, task.companyId);
      throw new ConflictException('That task is not in this company.');
    }
    return task.id;
  }

  private async rolesFor(userId: string, companyId: string): Promise<string[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId, companyId },
      select: { role: true },
    });
    return rows.map((row) => row.role);
  }

  private async rolesByCompany(userId: string): Promise<Map<string, string[]>> {
    const rows = await this.prisma.membership.findMany({
      where: { userId },
      select: { companyId: true, role: true },
    });
    const roles = new Map<string, string[]>();
    for (const row of rows) {
      const list = roles.get(row.companyId) ?? [];
      list.push(row.role);
      roles.set(row.companyId, list);
    }
    return roles;
  }

  private toDto(row: EntryRow, userId: string, roles: Map<string, string[]>): TimeEntryDto {
    const companyRoles = roles.get(row.companyId) ?? [];
    return {
      id: row.id,
      companyId: row.companyId,
      companyCode: row.company.code,
      userId: row.userId,
      userEmail: row.user.email,
      taskId: row.task?.id ?? null,
      taskTitle: row.task?.title ?? null,
      workDate: row.workDate.toISOString().slice(0, 10),
      minutes: row.minutes,
      note: row.note,
      status: row.status,
      reviewReason: row.reviewReason,
      actions: this.actionsFor(row, userId, companyRoles),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private actionsFor(
    row: EntryRow,
    userId: string,
    roles: string[],
  ): Array<'submit' | 'accept' | 'return'> {
    if (row.userId === userId && (row.status === 'open' || row.status === 'returned')) {
      return ['submit'];
    }
    if (
      row.status === 'submitted' &&
      (roles.includes('rm') || roles.includes('admin'))
    ) {
      return ['accept', 'return'];
    }
    return [];
  }
}
