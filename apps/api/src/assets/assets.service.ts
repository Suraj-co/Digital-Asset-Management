import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CompaniesService } from '../access/companies.service.js';
import { assetVisibility, type PortalMembership } from '../access/portal-scope.js';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  noticeSentence,
  NotificationsService,
} from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleWorkspaceService } from '../storage/google-workspace.js';
import type { AssetDto } from './asset.types.js';
import { DriveCleanupService } from './drive-cleanup.service.js';
import { UPLOAD_FAILURE_DETAIL, type UploadMeta } from './upload-file.js';
import { retireDriveFiles } from './version-retention.js';
import {
  allowedActions,
  planTransition,
  type WorkflowActionName,
} from './workflow.js';

function driveObjectName(title: string, fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const extension = dot > 0 ? fileName.slice(dot) : '';
  return title.toLowerCase().endsWith(extension.toLowerCase()) ? title : `${title}${extension}`;
}

const REVIEW_STAGES = [
  'scope_analysis',
  'rm_qc',
  'rm_approval',
  'admin_qc',
  'admin_approval',
] as const;

const assetInclude = {
  company: { select: { code: true } },
  folder: { select: { path: true, driveFolderId: true } },
  operations: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  versions: { orderBy: { number: 'asc' as const } },
  decisions: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      actor: { select: { email: true } },
      version: { select: { number: true } },
    },
  },
};

function versionLabel(number: number): string {
  return `v${String(number).padStart(3, '0')}`;
}

function auditAction(
  action: WorkflowActionName,
): 'asset_submitted' | 'asset_approved' | 'asset_rejected' | 'asset_published' {
  if (action === 'approve') {
    return 'asset_approved';
  }
  if (action === 'reject') {
    return 'asset_rejected';
  }
  if (action === 'publish') {
    return 'asset_published';
  }
  return 'asset_submitted';
}

function transitionSummary(
  email: string,
  code: string,
  action: WorkflowActionName,
  reason: string | null,
): string {
  if (action === 'reject') {
    return `${email} rejected ${code}: ${noticeSentence(reason ?? '')} The file is not stored.`;
  }
  if (action === 'publish') {
    return `${email} retried publication for ${code}. Google Drive was not called. The file was not moved.`;
  }
  if (action === 'approve') {
    return `${email} approved ${code}.`;
  }
  return `${email} submitted ${code}.`;
}

type AssetRow = Prisma.AssetGetPayload<{ include: typeof assetInclude }>;

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly google: GoogleWorkspaceService,
    private readonly driveCleanup: DriveCleanupService,
  ) {}

  async list(
    userId: string,
    companyId: string | undefined,
    limit: number,
    offset: number,
    query: string | undefined,
    folderId?: string,
  ): Promise<{ items: AssetDto[]; total: number }> {
    const companyIds = await this.visibleCompanyIds(userId, companyId);
    if (companyIds.length === 0) {
      return { items: [], total: 0 };
    }
    const where: Prisma.AssetWhereInput = {
      AND: [assetVisibility(userId, await this.memberships(userId), companyId)],
    };
    if (folderId) {
      where.folderId = folderId;
    }
    if (query) {
      where.OR = [
        { code: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        {
          operations: {
            some: { fileName: { contains: query, mode: 'insensitive' } },
          },
        },
        {
          versions: {
            some: { fileName: { contains: query, mode: 'insensitive' } },
          },
        },
      ];
    }
    const [total, rows, roles] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: assetInclude,
      }),
      this.rolesByCompany(userId, companyIds),
    ]);
    return {
      total,
      items: rows.map((row) => this.toDto(row, roles.get(row.companyId) ?? [])),
    };
  }

  async get(userId: string, assetId: string): Promise<AssetDto> {
    return this.present(userId, await this.requireVisible(userId, assetId));
  }

  async updateTitle(
    userId: string,
    assetId: string,
    title: string,
  ): Promise<AssetDto> {
    const asset = await this.requireVisible(userId, assetId);
    this.requireOwner(userId, asset, await this.rolesFor(userId, asset.companyId));
    const actorEmail = await this.audit.emailOf(userId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.asset.update({
        where: { id: assetId },
        data: { title },
        include: assetInclude,
      });
      await this.audit.write(tx, {
        companyId: asset.companyId,
        actorId: userId,
        action: 'asset_title_changed',
        summary: `${actorEmail} changed the title of ${asset.code} to "${title}". The file is still not stored.`,
        subjectType: 'asset',
        subjectId: asset.id,
      });
      return row;
    });
    const latest = updated.versions.at(-1);
    if (latest?.driveFileId) {
      try {
        await this.google.renameFile(latest.driveFileId, driveObjectName(title, latest.fileName));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google Drive did not rename the file.';
        throw new ServiceUnavailableException(
          `The title was saved. ${message}`,
        );
      }
    }
    return this.present(userId, updated);
  }

  async openFile(
    userId: string,
    assetId: string,
  ): Promise<{ fileName: string; contentType: string; bytes: Buffer }> {
    const asset = await this.requireVisible(userId, assetId);
    const latest = asset.versions.at(-1);
    if (!latest?.driveFileId) {
      throw new ConflictException(
        latest?.detail || 'This file is not in Google Drive.',
      );
    }
    const downloaded = await this.google.downloadFile(latest.driveFileId);
    return {
      fileName: latest.fileName,
      contentType: downloaded.contentType || latest.contentType,
      bytes: downloaded.bytes,
    };
  }

  async remove(userId: string, assetId: string): Promise<void> {
    const asset = await this.requireVisible(userId, assetId);
    this.requireOwner(userId, asset, await this.rolesFor(userId, asset.companyId));
    const links = await this.prisma.taskLink.count({ where: { assetId } });
    if (asset.decisions.length > 0 || links > 0) {
      throw new ConflictException(
        'This file is part of a review or a task and was not deleted.',
      );
    }
    const driveFileId = asset.versions.at(-1)?.driveFileId;
    if (driveFileId) {
      try {
        await this.google.trashFile(driveFileId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google Drive did not delete the file.';
        throw new ServiceUnavailableException(message);
      }
    }
    try {
      await this.prisma.asset.delete({ where: { id: assetId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException('This file is still referenced and was not deleted.');
      }
      throw error;
    }
  }

  async create(
    userId: string,
    input: { folderId: string; title: string; file: UploadMeta; idempotencyKey: string | null },
  ): Promise<AssetDto> {
    const folder = await this.folderForMember(userId, input.folderId);
    if (input.idempotencyKey) {
      const existing = await this.findIdempotent(userId, input.idempotencyKey);
      if (existing) {
        this.assertSameAttempt(existing, input);
        await this.resumeStoredFile(existing, input.file, await this.audit.emailOf(userId));
        return this.get(userId, existing.id);
      }
    }
    const actorEmail = await this.audit.emailOf(userId);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const latest = await tx.asset.findFirst({
            where: { companyId: folder.companyId },
            orderBy: { sequence: 'desc' },
            select: { sequence: true },
          });
          const sequence = (latest?.sequence ?? 0) + 1;
          const asset = await tx.asset.create({
            data: {
              companyId: folder.companyId,
              folderId: folder.id,
              sequence,
              code: `${folder.company.code}-${String(sequence).padStart(4, '0')}`,
              title: input.title,
              state: 'upload_failed',
              createdById: userId,
              operations: {
                create: {
                  userId,
                  status: 'drive_failed',
                  failureClass: 'not_configured',
                  fileName: input.file.fileName,
                  byteSize: input.file.byteSize,
                  contentType: input.file.contentType,
                  idempotencyKey: input.idempotencyKey,
                  detail: UPLOAD_FAILURE_DETAIL,
                },
              },
              versions: {
                create: this.versionData(userId, input.file, 1, null),
              },
            },
            include: assetInclude,
          });
          await this.audit.write(tx, {
            companyId: folder.companyId,
            actorId: userId,
            action: 'asset_recorded',
            summary: `${actorEmail} recorded "${asset.title}" as ${asset.code}. The file was not stored.`,
            subjectType: 'asset',
            subjectId: asset.id,
          });
          return asset;
        });
        const version = created.versions.at(-1);
        if (version) {
          await this.persistDriveFile({
            versionId: version.id,
            folderId: created.folderId,
            path: created.folder.path,
            driveFolderId: created.folder.driveFolderId,
            file: input.file,
            actorEmail,
            companyCode: created.company.code,
            code: created.code,
          });
        }
        return this.get(userId, created.id);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          input.idempotencyKey
        ) {
          const existing = await this.findIdempotent(userId, input.idempotencyKey);
          if (existing) {
            this.assertSameAttempt(existing, input);
            await this.resumeStoredFile(existing, input.file, actorEmail);
            return this.get(userId, existing.id);
          }
        }
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002' ||
          attempt === 2
        ) {
          throw error;
        }
      }
    }
    throw new ConflictException('The asset code could not be reserved.');
  }

  async retry(
    userId: string,
    assetId: string,
    file: UploadMeta,
  ): Promise<AssetDto> {
    const asset = await this.requireVisible(userId, assetId);
    this.requireOwner(userId, asset, await this.rolesFor(userId, asset.companyId));
    if (asset.workflowStage !== 'draft') {
      throw new ConflictException(
        'Send a new version after a rejection. Retry is only available on a draft.',
      );
    }
    const operation = asset.operations[0];
    const latest = asset.versions.at(-1);
    if (!operation || !latest) {
      throw new ConflictException('This upload has no version to retry.');
    }
    const actorEmail = await this.audit.emailOf(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.uploadOperation.update({
        where: { id: operation.id },
        data: {
          status: 'drive_failed',
          failureClass: 'not_configured',
          fileName: file.fileName,
          byteSize: file.byteSize,
          contentType: file.contentType,
          detail: UPLOAD_FAILURE_DETAIL,
        },
      });
      await tx.assetVersion.update({
        where: { id: latest.id },
        data: {
          fileName: file.fileName,
          byteSize: file.byteSize,
          contentType: file.contentType,
          state: 'upload_failed',
          failureClass: 'not_configured',
          detail: UPLOAD_FAILURE_DETAIL,
        },
      });
      await this.audit.write(tx, {
        companyId: asset.companyId,
        actorId: userId,
        action: 'asset_retried',
        summary: `${actorEmail} retried ${asset.code}. The file was not stored.`,
        subjectType: 'asset',
        subjectId: asset.id,
      });
    });
    await this.persistDriveFile({
      versionId: latest.id,
      folderId: asset.folderId,
      path: asset.folder.path,
      driveFolderId: asset.folder.driveFolderId,
      file,
      actorEmail,
      companyCode: asset.company.code,
      code: asset.code,
    });
    return this.get(userId, assetId);
  }

  async addVersion(
    userId: string,
    assetId: string,
    file: UploadMeta,
    idempotencyKey: string | null,
  ): Promise<AssetDto> {
    const asset = await this.requireVisible(userId, assetId);
    const ready =
      asset.workflowStage === 'admin_approval' && asset.publication === 'ready';
    if (this.isReview(asset.workflowStage) && !ready) {
      throw new ConflictException(
        'This asset is in review. Record another version after it is rejected.',
      );
    }
    const roles = await this.rolesFor(userId, asset.companyId);
    if (asset.workflowStage === 'changes_requested' && !roles.includes('creator')) {
      throw new ForbiddenException('You cannot decide this stage.');
    }
    this.requireOwner(userId, asset, roles);
    if (idempotencyKey) {
      const existing = await this.findVersionIdempotent(userId, idempotencyKey);
      if (existing) {
        this.assertSameVersion(existing, assetId, file);
        if (!existing.driveFileId) {
          const folder = await this.folderForMember(userId, asset.folderId);
          await this.persistDriveFile({
            versionId: existing.id,
            folderId: folder.id,
            path: folder.path,
            driveFolderId: folder.driveFolderId,
            file,
            actorEmail: await this.audit.emailOf(userId),
            companyCode: folder.company.code,
            code: asset.code,
          });
        }
        return this.get(userId, assetId);
      }
    }
    const actorEmail = await this.audit.emailOf(userId);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const versionId = await this.prisma.$transaction(async (tx) => {
          const current = await tx.asset.findUnique({
            where: { id: assetId },
            select: { workflowStage: true, publication: true, title: true },
          });
          if (!current) {
            throw new NotFoundException('No asset has that id.');
          }
          const currentReady =
            current.workflowStage === 'admin_approval' && current.publication === 'ready';
          if (this.isReview(current.workflowStage) && !currentReady) {
            throw new ConflictException(
              'This asset is in review. Record another version after it is rejected.',
            );
          }
          const latest = await tx.assetVersion.findFirst({
            where: { assetId },
            orderBy: { number: 'desc' },
            select: { number: true },
          });
          const version = await tx.assetVersion.create({
            data: {
              assetId,
              ...this.versionData(userId, file, (latest?.number ?? 0) + 1, idempotencyKey),
            },
          });
          const label = `v${String(version.number).padStart(3, '0')}`;
          if (currentReady) {
            await tx.asset.update({
              where: { id: assetId },
              data: { workflowStage: 'draft', publication: 'not_started' },
            });
            await this.audit.write(tx, {
              companyId: asset.companyId,
              actorId: userId,
              action: 'asset_version_recorded',
              summary: `${actorEmail} recorded ${label} on ${asset.code}. The approved version must be reviewed again.`,
              subjectType: 'asset',
              subjectId: asset.id,
            });
          } else if (current.workflowStage === 'changes_requested') {
            await tx.asset.update({
              where: { id: assetId },
              data: { workflowStage: 'scope_analysis', publication: 'not_started' },
            });
            await tx.workflowDecision.create({
              data: {
                assetId,
                versionId: version.id,
                action: 'resubmit',
                fromStage: 'changes_requested',
                toStage: 'scope_analysis',
                detail: 'A new version is in scope analysis. The file is not stored.',
                actorId: userId,
              },
            });
            await this.audit.write(tx, {
              companyId: asset.companyId,
              actorId: userId,
              action: 'asset_resubmitted',
              summary: `${actorEmail} recorded ${label} on ${asset.code} and returned it to scope analysis.`,
              subjectType: 'asset',
              subjectId: asset.id,
            });
            await this.notifyRole(tx, {
              companyId: asset.companyId,
              assetId,
              actorId: userId,
              role: 'rm',
              kind: 'asset_submitted',
              body: `${actorEmail} resubmitted "${current.title}" for RM review.`,
              href: `/assets/${assetId}`,
            });
          } else {
            await this.audit.write(tx, {
              companyId: asset.companyId,
              actorId: userId,
              action: 'asset_version_recorded',
              summary: `${actorEmail} recorded ${label} on ${asset.code}. The file was not stored.`,
              subjectType: 'asset',
              subjectId: asset.id,
            });
          }
          return version.id;
        });
        const folder = await this.folderForMember(userId, (
          await this.prisma.asset.findUniqueOrThrow({
            where: { id: assetId },
            select: { folderId: true },
          })
        ).folderId);
        await this.persistDriveFile({
          versionId,
          folderId: folder.id,
          path: folder.path,
          driveFolderId: folder.driveFolderId,
          file,
          actorEmail,
          companyCode: folder.company.code,
          code: asset.code,
        });
        return this.get(userId, assetId);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          idempotencyKey
        ) {
          const existing = await this.findVersionIdempotent(userId, idempotencyKey);
          if (existing) {
            this.assertSameVersion(existing, assetId, file);
            if (!existing.driveFileId) {
              const folder = await this.folderForMember(userId, asset.folderId);
              await this.persistDriveFile({
                versionId: existing.id,
                folderId: folder.id,
                path: folder.path,
                driveFolderId: folder.driveFolderId,
                file,
                actorEmail,
                companyCode: folder.company.code,
                code: asset.code,
              });
            }
            return this.get(userId, assetId);
          }
        }
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002' ||
          attempt === 2
        ) {
          throw error;
        }
      }
    }
    throw new ConflictException('The version number could not be reserved.');
  }

  async transition(
    userId: string,
    assetId: string,
    input: { action: WorkflowActionName; reason: string | null },
  ): Promise<AssetDto> {
    const asset = await this.requireVisible(userId, assetId);
    const latest = asset.versions.at(-1);
    if (!latest) {
      throw new ConflictException('This upload has no version to review.');
    }
    const roles = await this.rolesFor(userId, asset.companyId);
    const planned = planTransition({
      action: input.action,
      stage: asset.workflowStage,
      publication: asset.publication,
      roles,
      reason: input.reason,
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
      const moved = await tx.asset.updateMany({
        where: {
          id: assetId,
          workflowStage: asset.workflowStage,
          publication: asset.publication,
        },
        data: {
          workflowStage: planned.toStage,
          publication: planned.publication,
          approvedVersionId: planned.publication === 'ready' ? latest.id : undefined,
        },
      });
      if (moved.count !== 1) {
        throw new ConflictException('This asset was already decided.');
      }
      if (planned.publication === 'ready') {
        await this.queueRetiredFiles(tx, assetId, latest.id);
      }
      await tx.workflowDecision.create({
        data: {
          assetId,
          versionId: latest.id,
          action: planned.action,
          fromStage: asset.workflowStage,
          toStage: planned.toStage,
          reason: planned.action === 'reject' ? input.reason : null,
          detail: planned.detail,
          actorId: userId,
        },
      });
      await this.notifyDecision(tx, {
        asset,
        actorId: userId,
        actorEmail: actor.email,
        action: planned.action,
        toStage: planned.toStage,
        publication: planned.publication,
        reason: input.reason,
        versionLabel: versionLabel(latest.number),
      });
      await this.audit.write(tx, {
        companyId: asset.companyId,
        actorId: userId,
        action: auditAction(planned.action),
        summary: `${transitionSummary(actor.email, asset.code, planned.action, input.reason)} ${asset.workflowStage} to ${planned.toStage} on ${versionLabel(latest.number)}.`,
        subjectType: 'asset',
        subjectId: asset.id,
      });
    });
    if (planned.publication === 'ready') {
      const jobs = await this.prisma.driveCleanup.findMany({
        where: { version: { assetId }, status: 'pending' },
        select: { id: true },
      });
      for (const job of jobs) {
        await this.driveCleanup.enqueue(job.id);
      }
    }
    return this.get(userId, assetId);
  }

  private async notifyDecision(
    tx: Prisma.TransactionClient,
    input: {
      asset: AssetRow;
      actorId: string;
      actorEmail: string;
      action: WorkflowActionName;
      toStage: string;
      publication: string;
      reason: string | null;
      versionLabel: string;
    },
  ): Promise<void> {
    const href = `/assets/${input.asset.id}`;
    if (input.action === 'submit') {
      await this.notifyRole(tx, {
        companyId: input.asset.companyId,
        assetId: input.asset.id,
        actorId: input.actorId,
        role: 'rm',
        kind: 'asset_submitted',
        body: `${input.actorEmail} submitted "${input.asset.title}" for RM review.`,
        href,
      });
      return;
    }
    if (input.action === 'reject') {
      await this.notifications.write(tx, {
        companyId: input.asset.companyId,
        recipientId: input.asset.createdById,
        actorId: input.actorId,
        kind: 'asset_rejected',
        body: `${input.actorEmail} rejected "${input.asset.title}": ${noticeSentence(input.reason ?? '')}`,
        href,
      });
      return;
    }
    if (input.action === 'approve' || input.action === 'publish') {
      await this.notifications.write(tx, {
        companyId: input.asset.companyId,
        recipientId: input.asset.createdById,
        actorId: input.actorId,
        kind: 'asset_approved',
        body:
          input.publication === 'ready'
            ? `${input.actorEmail} approved "${input.asset.title}". It is ready to publish.`
            : `${input.actorEmail} approved "${input.asset.title}" (${input.versionLabel}).`,
        href,
      });
      if (input.toStage === 'admin_qc') {
        await this.notifyRole(tx, {
          companyId: input.asset.companyId,
          assetId: input.asset.id,
          actorId: input.actorId,
          role: 'admin',
          kind: 'asset_submitted',
          body: `${input.actorEmail} forwarded "${input.asset.title}" for admin review.`,
          href,
        });
      }
    }
  }

  private async notifyRole(
    tx: Prisma.TransactionClient,
    input: {
      companyId: string;
      assetId: string;
      actorId: string;
      role: 'rm' | 'admin';
      kind: 'asset_submitted' | 'asset_approved' | 'asset_rejected';
      body: string;
      href: string;
    },
  ): Promise<void> {
    let recipientIds: string[] = [];
    if (input.role === 'rm') {
      const links = await tx.taskLink.findMany({
        where: { assetId: input.assetId },
        select: { task: { select: { createdById: true } } },
      });
      const candidateIds = [...new Set(links.map((link) => link.task.createdById))];
      if (candidateIds.length > 0) {
        const members = await tx.membership.findMany({
          where: {
            companyId: input.companyId,
            userId: { in: candidateIds },
            role: { in: ['rm', 'admin'] },
          },
          select: { userId: true },
        });
        recipientIds = [...new Set(members.map((member) => member.userId))];
      }
    }
    if (recipientIds.length === 0) {
      const rows = await tx.membership.findMany({
        where: { companyId: input.companyId, role: input.role },
        select: { userId: true },
      });
      recipientIds = rows.map((row) => row.userId);
    }
    for (const recipientId of recipientIds) {
      await this.notifications.write(tx, {
        companyId: input.companyId,
        recipientId,
        actorId: input.actorId,
        kind: input.kind,
        body: input.body,
        href: input.href,
      });
    }
  }

  private async requireVisible(userId: string, assetId: string): Promise<AssetRow> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: assetInclude,
    });
    if (!asset) {
      throw new NotFoundException('No asset has that id.');
    }
    await this.companies.requireMember(userId, asset.companyId);
    const visible = await this.prisma.asset.findFirst({
      where: { AND: [{ id: assetId }, assetVisibility(userId, await this.memberships(userId))] },
      select: { id: true },
    });
    if (!visible) {
      throw new NotFoundException('No asset has that id.');
    }
    return asset;
  }

  private requireOwner(userId: string, asset: { createdById: string }, roles: readonly string[]): void {
    if (asset.createdById === userId || roles.includes('admin')) {
      return;
    }
    throw new ForbiddenException('You cannot change this asset.');
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

  private async queueRetiredFiles(
    tx: Prisma.TransactionClient,
    assetId: string,
    approvedVersionId: string,
  ): Promise<void> {
    const versions = await tx.assetVersion.findMany({
      where: { assetId },
      select: { id: true, driveFileId: true },
    });
    for (const retired of retireDriveFiles({ approvedVersionId, versions })) {
      const existing = await tx.driveCleanup.findUnique({
        where: { versionId: retired.versionId },
        select: { status: true },
      });
      if (existing?.status === 'deleted') {
        continue;
      }
      if (existing) {
        await tx.driveCleanup.update({
          where: { versionId: retired.versionId },
          data: {
            status: 'pending',
            driveFileId: retired.driveFileId,
            detail: '',
            attempts: 0,
          },
        });
      } else {
        await tx.driveCleanup.create({
          data: {
            versionId: retired.versionId,
            driveFileId: retired.driveFileId,
          },
        });
      }
    }
  }

  private async resumeStoredFile(asset: AssetRow, file: UploadMeta, actorEmail: string): Promise<void> {
    const latest = asset.versions.at(-1);
    if (!latest || latest.driveFileId) {
      return;
    }
    await this.persistDriveFile({
      versionId: latest.id,
      folderId: asset.folderId,
      path: asset.folder.path,
      driveFolderId: asset.folder.driveFolderId,
      file,
      actorEmail,
      companyCode: asset.company.code,
      code: asset.code,
    });
  }

  private async folderForMember(userId: string, folderId: string) {
    const folder = await this.prisma.folderCatalog.findUnique({
      where: { id: folderId },
      include: { company: { select: { id: true, code: true } } },
    });
    if (!folder) {
      throw new NotFoundException('No folder has that id.');
    }
    await this.companies.requireMember(userId, folder.companyId);
    return folder;
  }

  private async persistDriveFile(input: {
    versionId: string;
    folderId: string;
    path: string;
    driveFolderId: string | null;
    file: UploadMeta;
    actorEmail: string;
    companyCode: string;
    code: string;
  }): Promise<void> {
    const bytes = input.file.bytes;
    input.file.bytes = undefined;
    if (!bytes || bytes.length === 0 || !this.google.driveReady()) {
      return;
    }
    const stored = await this.prisma.assetVersion.findUnique({
      where: { id: input.versionId },
      select: { driveFileId: true },
    });
    if (stored?.driveFileId) {
      return;
    }
    try {
      let parentId = input.driveFolderId;
      if (!parentId) {
        parentId = await this.google.ensureFolder(input.path);
        if (parentId) {
          await this.prisma.folderCatalog.update({
            where: { id: input.folderId },
            data: { driveFolderId: parentId },
          });
        }
      }
      if (!parentId) {
        return;
      }
      const driveFileId = await this.google.uploadFile({
        parentId,
        name: input.file.fileName,
        contentType: input.file.contentType,
        body: bytes,
      });
      const claimed = await this.prisma.assetVersion.updateMany({
        where: { id: input.versionId, driveFileId: null },
        data: { driveFileId, detail: 'Stored in Google Drive.' },
      });
      if (claimed.count !== 1) {
        await this.google.trashFile(driveFileId);
        return;
      }
      await this.google.appendHistory({
        actor: input.actorEmail,
        action: 'file_stored',
        company: input.companyCode,
        path: input.path,
        name: input.file.fileName,
        driveId: driveFileId,
        detail: `${input.code} stored in Google Drive.`,
      });
    } catch {
      await this.prisma.assetVersion
        .update({
          where: { id: input.versionId },
          data: { detail: 'Google Drive did not store the file. The metadata was kept.' },
        })
        .catch(() => undefined);
    }
  }

  private versionData(
    userId: string,
    file: UploadMeta,
    number: number,
    idempotencyKey: string | null,
  ) {
    return {
      number,
      fileName: file.fileName,
      byteSize: file.byteSize,
      contentType: file.contentType,
      state: 'upload_failed' as const,
      failureClass: 'not_configured' as const,
      detail: UPLOAD_FAILURE_DETAIL,
      idempotencyKey,
      createdById: userId,
    };
  }

  private findVersionIdempotent(userId: string, idempotencyKey: string) {
    return this.prisma.assetVersion.findFirst({
      where: { createdById: userId, idempotencyKey },
    });
  }

  private assertSameVersion(
    existing: { assetId: string; fileName: string; byteSize: number },
    assetId: string,
    file: UploadMeta,
  ): void {
    const same =
      existing.assetId === assetId &&
      existing.fileName === file.fileName &&
      existing.byteSize === file.byteSize;
    if (!same) {
      throw new ConflictException('That idempotency key was already used.');
    }
  }

  private findIdempotent(userId: string, idempotencyKey: string) {
    return this.prisma.asset.findFirst({
      where: { operations: { some: { userId, idempotencyKey } } },
      include: assetInclude,
    });
  }

  private assertSameAttempt(
    existing: AssetRow,
    input: { folderId: string; title: string; file: UploadMeta },
  ): void {
    const operation = existing.operations[0];
    const same =
      existing.folderId === input.folderId &&
      existing.title === input.title &&
      operation?.fileName === input.file.fileName &&
      operation?.byteSize === input.file.byteSize;
    if (!same) {
      throw new ConflictException('That idempotency key was already used.');
    }
  }

  private async present(userId: string, row: AssetRow): Promise<AssetDto> {
    return this.toDto(row, await this.rolesFor(userId, row.companyId));
  }

  private async rolesFor(userId: string, companyId: string): Promise<string[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId, companyId },
      select: { role: true },
    });
    return rows.map((row) => row.role);
  }

  private async rolesByCompany(
    userId: string,
    companyIds: string[],
  ): Promise<Map<string, string[]>> {
    const rows = await this.prisma.membership.findMany({
      where: { userId, companyId: { in: companyIds } },
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

  private isReview(stage: string): boolean {
    return (REVIEW_STAGES as readonly string[]).includes(stage);
  }

  private toDto(row: AssetRow, roles: readonly string[]): AssetDto {
    const operation = row.operations[0];
    const latest = row.versions.at(-1);
    const summary = latest ?? operation;
    if (!summary) {
      throw new ConflictException('This upload has no version to retry.');
    }
    return {
      id: row.id,
      companyId: row.companyId,
      companyCode: row.company.code,
      folderId: row.folderId,
      path: row.folder.path,
      code: row.code,
      title: row.title,
      state: row.state,
      fileName: summary.fileName,
      byteSize: summary.byteSize,
      contentType: summary.contentType,
      driveFileId: latest?.driveFileId ?? null,
      failureClass: summary.failureClass,
      detail: summary.detail,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      workflowStage: row.workflowStage,
      publication: row.publication,
      actions: allowedActions(row.workflowStage, row.publication, roles),
      decisions: row.decisions.map((decision) => ({
        id: decision.id,
        versionId: decision.versionId,
        versionLabel: versionLabel(decision.version.number),
        action: decision.action,
        fromStage: decision.fromStage,
        toStage: decision.toStage,
        reason: decision.reason,
        detail: decision.detail,
        actorEmail: decision.actor.email,
        createdAt: decision.createdAt.toISOString(),
      })),
      versions: row.versions.map((version) => ({
        id: version.id,
        number: version.number,
        label: versionLabel(version.number),
        fileName: version.fileName,
        byteSize: version.byteSize,
        contentType: version.contentType,
        state: version.state,
        driveFileId: version.driveFileId,
        failureClass: version.failureClass,
        detail: version.detail,
        createdAt: version.createdAt.toISOString(),
      })),
    };
  }
}
