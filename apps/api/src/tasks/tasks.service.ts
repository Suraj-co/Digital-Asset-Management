import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompaniesService } from '../access/companies.service.js';
import { taskVisibility, type PortalMembership } from '../access/portal-scope.js';
import { AuditService } from '../audit/audit.service.js';
import { loadEnv } from '../config/env.js';
import { Prisma } from '../generated/prisma/client.js';
import { assignmentEmail, taskViewUrl, type AssignerRole } from '../mail/assignment-email.js';
import { mailboxError } from '../mail/mailbox.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleWorkspaceService } from '../storage/google-workspace.js';
import {
  planTaskTransition,
  TASK_STAGE_LABEL,
  taskActions,
  type TaskAction,
  type TaskStage,
} from './task-workflow.js';
import type { TaskDetailDto, TaskDto, TaskStageCountsDto } from './task.types.js';

type TaskPriorityValue = 'low' | 'normal' | 'high';

const taskInclude = {
  company: { select: { code: true } },
  department: { select: { id: true, name: true } },
  createdBy: { select: { id: true, email: true } },
  assignments: {
    orderBy: { createdAt: 'asc' as const },
    take: 1,
    include: { user: { select: { id: true, email: true } } },
  },
  links: {
    orderBy: { createdAt: 'asc' as const },
    take: 1,
    include: { asset: { select: { id: true, code: true, companyId: true } } },
  },
};

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly google: GoogleWorkspaceService,
  ) {}

  async list(
    userId: string,
    companyId: string | undefined,
    departmentId: string | undefined,
    limit: number,
    offset: number,
  ): Promise<{ items: TaskDto[]; total: number; stages: TaskStageCountsDto }> {
    const companyIds = await this.visibleCompanyIds(userId, companyId);
    if (companyIds.length === 0) {
      return { items: [], total: 0, stages: emptyStages() };
    }
    if (departmentId) {
      await this.departmentInScope(userId, companyId, departmentId);
    }
    const memberships = await this.memberships(userId);
    const where: Prisma.TaskWhereInput = {
      AND: [
        taskVisibility(userId, memberships, companyId),
        departmentId ? { departmentId } : {},
      ],
    };
    const [total, rows, grouped] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
        include: taskInclude,
      }),
      this.prisma.task.groupBy({ by: ['stage'], where, _count: { _all: true } }),
    ]);
    return {
      total,
      stages: stageCounts(grouped),
      items: rows.map((row) => this.toDto(row, userId, memberships)),
    };
  }

  async get(userId: string, taskId: string): Promise<TaskDetailDto> {
    const task = await this.requireVisible(userId, taskId);
    const memberships = await this.memberships(userId);
    const [comments, files, history] = await Promise.all([
      this.prisma.taskComment.findMany({
        where: { taskId },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { email: true } } },
      }),
      this.prisma.taskFile.findMany({
        where: { taskId },
        orderBy: { createdAt: 'asc' },
        include: { createdBy: { select: { email: true } } },
      }),
      this.prisma.auditEvent.findMany({
        where: { subjectType: 'task', subjectId: taskId },
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: { actor: { select: { email: true } } },
      }),
    ]);
    return {
      ...this.toDto(task, userId, memberships),
      comments: comments.map((row) => ({
        id: row.id,
        authorEmail: row.author.email,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      })),
      files: files.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        byteSize: row.byteSize,
        driveFileId: row.driveFileId,
        detail: row.detail,
        createdByEmail: row.createdBy.email,
        createdAt: row.createdAt.toISOString(),
      })),
      history: history.map((row) => ({
        actorEmail: row.actor.email,
        summary: row.summary,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async create(
    userId: string,
    input: {
      companyId: string;
      title: string;
      detail?: string;
      assetId?: string;
      assigneeEmail?: string;
      deadline?: string;
      priority?: TaskPriorityValue;
    },
  ): Promise<TaskDto> {
    await this.companies.requireMember(userId, input.companyId);
    const asset = await this.assetInCompany(userId, input.companyId, input.assetId);
    const assignee = await this.memberByEmail(input.companyId, input.assigneeEmail);
    const actor = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const deadline = this.deadlineValue(input.deadline);
    const memberships = await this.memberships(userId);
    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          companyId: input.companyId,
          title: input.title,
          detail: input.detail ?? '',
          stage: assignee ? 'assigned' : 'draft',
          departmentId: asset?.departmentId,
          deadline,
          priority: input.priority,
          createdById: userId,
          assignments: assignee
            ? { create: { userId: assignee.id } }
            : undefined,
          links: asset ? { create: { assetId: asset.id } } : undefined,
        },
        include: taskInclude,
      });
      if (assignee) {
        await this.notifications.write(tx, {
          companyId: input.companyId,
          recipientId: assignee.id,
          actorId: userId,
          kind: 'task_assigned',
          body: this.assignmentBody(actor.email, task),
          href: '/tasks',
          mail: await this.assignmentMail(userId, input.companyId, task),
        });
      }
      await this.audit.write(tx, {
        companyId: input.companyId,
        actorId: userId,
        action: 'task_planned',
        summary: `${actor.email} planned "${input.title}".`,
        subjectType: 'task',
        subjectId: task.id,
      });
      return task;
    });
    return this.toDto(created, userId, memberships);
  }

  async update(
    userId: string,
    taskId: string,
    input: {
      title?: string;
      detail?: string;
      status?: 'open' | 'done';
      assetId?: string | null;
      assigneeEmail?: string | null;
      deadline?: string | null;
      priority?: TaskPriorityValue | null;
    },
  ): Promise<TaskDetailDto> {
    const task = await this.requireVisible(userId, taskId);
    if (input.status) {
      throw new BadRequestException('Use a task transition.');
    }
    const reviewLocked = !['draft', 'assigned', 'changes_requested'].includes(task.stage);
    if (reviewLocked && (input.assigneeEmail !== undefined || input.assetId !== undefined)) {
      throw new ConflictException('This task is already in review.');
    }
    const asset =
      input.assetId === undefined
        ? undefined
        : await this.assetInCompany(userId, task.companyId, input.assetId);
    const assignee =
      input.assigneeEmail === undefined
        ? undefined
        : await this.memberByEmail(task.companyId, input.assigneeEmail);
    const previousAssigneeId = task.assignments[0]?.user.id;
    const actor = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const title = input.title ?? task.title;
    const stage = nextStage(task.stage, assignee, input.assigneeEmail !== undefined);
    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          title: input.title,
          detail: input.detail,
          stage,
          departmentId:
            input.assetId === undefined ? undefined : asset ? asset.departmentId : null,
          deadline:
            input.deadline === undefined ? undefined : this.deadlineValue(input.deadline),
          priority: input.priority,
        },
      });
      if (input.assetId !== undefined) {
        await tx.taskLink.deleteMany({ where: { taskId } });
        if (asset) {
          await tx.taskLink.create({ data: { taskId, assetId: asset.id } });
        }
      }
      if (input.assigneeEmail !== undefined) {
        await tx.taskAssignment.deleteMany({ where: { taskId } });
        if (assignee) {
          await tx.taskAssignment.create({ data: { taskId, userId: assignee.id } });
        }
      }
      if (assignee && assignee.id !== previousAssigneeId) {
        const current = await tx.task.findUniqueOrThrow({
          where: { id: taskId },
          include: taskInclude,
        });
        await this.notifications.write(tx, {
          companyId: task.companyId,
          recipientId: assignee.id,
          actorId: userId,
          kind: 'task_assigned',
          body: this.assignmentBody(actor.email, { ...current, title }),
          href: '/tasks',
          mail: await this.assignmentMail(userId, task.companyId, current),
        });
      }
      await this.audit.write(tx, {
        companyId: task.companyId,
        actorId: userId,
        action: 'task_changed',
        summary: `${actor.email} updated "${title}".`,
        subjectType: 'task',
        subjectId: task.id,
      });
    });
    return this.get(userId, taskId);
  }

  async transition(
    userId: string,
    taskId: string,
    action: TaskAction,
    reason: string | null,
  ): Promise<TaskDetailDto> {
    const task = await this.requireVisible(userId, taskId);
    const roles = await this.rolesFor(userId, task.companyId);
    const planned = planTaskTransition({
      action,
      stage: task.stage,
      roles,
      isAssignee: task.assignments[0]?.user.id === userId,
      isResponsible:
        task.createdBy.id === userId && (roles.includes('rm') || roles.includes('admin')),
      reason,
    });
    if ('status' in planned) {
      if (planned.status === 400) {
        throw new BadRequestException(planned.message);
      }
      if (planned.status === 403) {
        throw new ForbiddenException(planned.message);
      }
      throw new ConflictException(planned.message);
    }
    const actor = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.task.updateMany({
        where: { id: taskId, stage: task.stage },
        data: {
          stage: planned.to,
          status: planned.to === 'completed' ? 'done' : 'open',
        },
      });
      if (moved.count !== 1) {
        throw new ConflictException('This task was already decided.');
      }
      if (action === 'reject' && reason) {
        await tx.taskComment.create({
          data: { taskId, authorId: userId, body: reason },
        });
      }
      await this.notifyStage(tx, {
        task,
        actorId: userId,
        actorEmail: actor.email,
        to: planned.to,
        reason,
      });
      await this.audit.write(tx, {
        companyId: task.companyId,
        actorId: userId,
        action: 'task_changed',
        summary: `${actor.email} moved "${task.title}" from ${TASK_STAGE_LABEL[task.stage]} to ${TASK_STAGE_LABEL[planned.to]}.${reason ? ` ${reason}` : ''}`,
        subjectType: 'task',
        subjectId: task.id,
      });
    });
    return this.get(userId, taskId);
  }

  async comment(userId: string, taskId: string, body: string): Promise<TaskDetailDto> {
    const task = await this.requireVisible(userId, taskId);
    const text = body.trim();
    if (text.length === 0) {
      throw new BadRequestException('Enter a comment.');
    }
    const actor = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.taskComment.create({ data: { taskId, authorId: userId, body: text } });
      await this.audit.write(tx, {
        companyId: task.companyId,
        actorId: userId,
        action: 'task_changed',
        summary: `${actor.email} commented on "${task.title}".`,
        subjectType: 'task',
        subjectId: task.id,
      });
    });
    return this.get(userId, taskId);
  }

  async addFile(
    userId: string,
    taskId: string,
    file: { name: string; contentType: string; byteSize: number; bytes: Buffer } | undefined,
  ): Promise<TaskDetailDto> {
    const task = await this.requireVisible(userId, taskId);
    if (!file || file.bytes.length === 0) {
      throw new BadRequestException('Choose a file.');
    }
    const actor = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    let driveFileId: string | null = null;
    let detail = 'The file was not stored.';
    if (this.google.driveReady()) {
      try {
        const parentId = await this.google.ensureFolder(`AARADHYA_DAM/${task.company.code}/Tasks`);
        if (!parentId) {
          throw new Error('Google Drive did not return a folder.');
        }
        driveFileId = await this.google.uploadFile({
          parentId,
          name: file.name,
          contentType: file.contentType,
          body: file.bytes,
        });
        detail = 'Stored in Google Drive.';
      } catch (error) {
        detail = error instanceof Error ? error.message : 'Google Drive did not store the file.';
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.taskFile.create({
        data: {
          taskId,
          fileName: file.name,
          byteSize: file.byteSize,
          contentType: file.contentType,
          driveFileId,
          detail,
          createdById: userId,
        },
      });
      await this.audit.write(tx, {
        companyId: task.companyId,
        actorId: userId,
        action: 'task_changed',
        summary: `${actor.email} attached "${file.name}" to "${task.title}". ${detail}`,
        subjectType: 'task',
        subjectId: task.id,
      });
    });
    return this.get(userId, taskId);
  }

  private assignmentBody(
    email: string,
    task: {
      title: string;
      detail: string;
      deadline: Date | null;
      priority: TaskPriorityValue | null;
    },
  ): string {
    const description = task.detail.trim();
    return [
      `${email} assigned "${task.title}".`,
      `Description: ${description.length > 0 ? description : 'None'}`,
      `Deadline: ${task.deadline ? task.deadline.toISOString().slice(0, 10) : 'Not set'}`,
      `Priority: ${task.priority ?? 'Not set'}`,
    ].join(' ');
  }

  private async requireVisible(userId: string, taskId: string): Promise<TaskRow> {
    const task = await this.findTask(taskId);
    await this.companies.requireMember(userId, task.companyId);
    const visible = await this.prisma.task.findFirst({
      where: { AND: [{ id: taskId }, taskVisibility(userId, await this.memberships(userId))] },
      select: { id: true },
    });
    if (!visible) {
      throw new NotFoundException('No task has that id.');
    }
    return task;
  }

  private async memberships(userId: string): Promise<PortalMembership[]> {
    return this.prisma.membership.findMany({
      where: { userId },
      select: { companyId: true, role: true },
    });
  }

  private async visibleCompanyIds(
    userId: string,
    companyId: string | undefined,
  ): Promise<string[]> {
    if (companyId) {
      await this.companies.requireMember(userId, companyId);
      return [companyId];
    }
    const rows = await this.prisma.membership.findMany({
      where: { userId },
      select: { companyId: true },
      distinct: ['companyId'],
    });
    return rows.map((row) => row.companyId);
  }

  private async findTask(taskId: string): Promise<TaskRow> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: taskInclude,
    });
    if (!task) {
      throw new NotFoundException('No task has that id.');
    }
    return task;
  }

  private async notifyStage(
    tx: Prisma.TransactionClient,
    input: {
      task: TaskRow;
      actorId: string;
      actorEmail: string;
      to: TaskStage;
      reason: string | null;
    },
  ): Promise<void> {
    const href = `/tasks/${input.task.id}`;
    const label = TASK_STAGE_LABEL[input.to];
    const reason = input.reason?.trim();
    const body = reason
      ? `${input.actorEmail} set "${input.task.title}" to ${label}. ${reason}`
      : `${input.actorEmail} set "${input.task.title}" to ${label}.`;
    const recipients = new Set<string>();
    if (input.to === 'submitted_rm_qc') {
      recipients.add(input.task.createdBy.id);
    } else {
      const assigneeId = input.task.assignments[0]?.user.id;
      if (assigneeId) {
        recipients.add(assigneeId);
      }
    }
    if (input.to === 'submitted_admin_qc') {
      const admins = await tx.membership.findMany({
        where: { companyId: input.task.companyId, role: 'admin' },
        select: { userId: true },
      });
      for (const admin of admins) {
        recipients.add(admin.userId);
      }
    }
    for (const recipientId of recipients) {
      await this.notifications.write(tx, {
        companyId: input.task.companyId,
        recipientId,
        actorId: input.actorId,
        kind: 'task_updated',
        body,
        href,
      });
    }
  }

  private async rolesFor(userId: string, companyId: string): Promise<string[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId, companyId },
      select: { role: true },
    });
    return rows.map((row) => row.role);
  }

  private async departmentInScope(
    userId: string,
    companyId: string | undefined,
    departmentId: string,
  ): Promise<void> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { companyId: true },
    });
    if (!department) {
      throw new NotFoundException('No department has that id.');
    }
    if (companyId && department.companyId !== companyId) {
      await this.companies.requireMember(userId, department.companyId);
      throw new ConflictException('That department is not in this company.');
    }
    await this.companies.requireMember(userId, department.companyId);
  }

  private async assetInCompany(
    userId: string,
    companyId: string,
    assetId: string | null | undefined,
  ): Promise<{ id: string; departmentId: string } | null> {
    if (!assetId) {
      return null;
    }
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, companyId: true, folder: { select: { departmentId: true } } },
    });
    if (!asset) {
      throw new NotFoundException('No asset has that id.');
    }
    if (asset.companyId !== companyId) {
      await this.companies.requireMember(userId, asset.companyId);
      throw new ConflictException('That asset is not in this company.');
    }
    return { id: asset.id, departmentId: asset.folder.departmentId };
  }

  private async assignerRole(
    userId: string,
    companyId: string,
  ): Promise<AssignerRole | 'creator' | null> {
    const rows = await this.prisma.membership.findMany({
      where: { userId, companyId },
      select: { role: true },
    });
    if (rows.some((row) => row.role === 'admin')) {
      return 'admin';
    }
    if (rows.some((row) => row.role === 'rm')) {
      return 'rm';
    }
    if (rows.some((row) => row.role === 'creator')) {
      return 'creator';
    }
    return null;
  }

  private async assignmentMail(
    userId: string,
    companyId: string,
    task: { id: string; title: string; detail: string; deadline: Date | null; priority: TaskPriorityValue | null },
  ): Promise<{ subject: string; text: string } | undefined> {
    const role = await this.assignerRole(userId, companyId);
    if (role !== 'rm' && role !== 'admin') {
      return undefined;
    }
    return assignmentEmail({
      role,
      title: task.title,
      description: task.detail,
      deadline: task.deadline ? task.deadline.toISOString().slice(0, 10) : null,
      priority: task.priority,
      taskUrl: taskViewUrl(loadEnv().webOrigin),
    });
  }

  private deadlineValue(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Enter a deadline as YYYY-MM-DD.');
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Enter a real deadline.');
    }
    return date;
  }

  private async memberByEmail(
    companyId: string,
    email: string | null | undefined,
  ): Promise<{ id: string } | null> {
    if (!email) {
      return null;
    }
    if (mailboxError(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, status: true },
    });
    if (!user) {
      throw new NotFoundException('No user has that email.');
    }
    if (user.status !== 'active') {
      throw new ForbiddenException('This account is disabled.');
    }
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, companyId },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this user.');
    }
    return user;
  }

  private toDto(row: TaskRow, userId: string, memberships: PortalMembership[]): TaskDto {
    const roles = memberships
      .filter((rowMembership) => rowMembership.companyId === row.companyId)
      .map((rowMembership) => rowMembership.role);
    const assignment = row.assignments[0];
    const link = row.links[0];
    return {
      id: row.id,
      companyId: row.companyId,
      companyCode: row.company.code,
      title: row.title,
      detail: row.detail,
      status: row.status,
      stage: row.stage,
      actions: taskActions({
        stage: row.stage,
        roles,
        isAssignee: assignment?.user.id === userId,
        isResponsible:
          row.createdBy.id === userId && (roles.includes('rm') || roles.includes('admin')),
      }),
      departmentId: row.department?.id ?? null,
      departmentName: row.department?.name ?? null,
      deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : null,
      priority: row.priority,
      assetId: link?.asset.id ?? null,
      assetCode: link?.asset.code ?? null,
      assigneeId: assignment?.user.id ?? null,
      assigneeEmail: assignment?.user.email ?? null,
      createdByEmail: row.createdBy.email,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function nextStage(
  stage: TaskStage,
  assignee: { id: string } | null | undefined,
  assigneeChanged: boolean,
): TaskStage | undefined {
  if (!assigneeChanged) {
    return undefined;
  }
  if (!assignee && (stage === 'assigned' || stage === 'draft')) {
    return 'draft';
  }
  if (assignee && stage === 'draft') {
    return 'assigned';
  }
  return undefined;
}

function emptyStages(): TaskStageCountsDto {
  return {
    draft: 0,
    assigned: 0,
    in_progress: 0,
    submitted_rm_qc: 0,
    rm_approved: 0,
    submitted_admin_qc: 0,
    admin_approved: 0,
    ready_to_publish: 0,
    completed: 0,
    changes_requested: 0,
  };
}

function stageCounts(
  rows: { stage: TaskStage; _count: { _all: number } }[],
): TaskStageCountsDto {
  const counts = emptyStages();
  for (const row of rows) {
    counts[row.stage] = row._count._all;
  }
  return counts;
}
