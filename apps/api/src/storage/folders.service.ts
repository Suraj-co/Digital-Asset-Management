import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompaniesService } from '../access/companies.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleWorkspaceService } from './google-workspace.js';
import type { DepartmentDto, FolderCatalogDto } from './folder.types.js';
import {
  folderPath,
  isSafeSegment,
  type FolderAssetTypeName,
  type FolderStageName,
} from './folder-path.js';

const NOT_CALLED =
  'The folder row was stored. Google Drive was not called. No Drive folder id was stored.';

type FolderRow = {
  id: string;
  companyId: string;
  departmentId: string;
  year: number;
  campaign: string;
  stage: FolderStageName;
  assetType: FolderAssetTypeName;
  path: string;
  driveFolderId: string | null;
  company: { code: string };
  department: { name: string };
};

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
    private readonly google: GoogleWorkspaceService,
  ) {}

  async listDepartments(
    userId: string,
    companyId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: DepartmentDto[]; total: number }> {
    await this.companies.requireMember(userId, companyId);
    const where = { companyId };
    const [total, rows] = await Promise.all([
      this.prisma.department.count({ where }),
      this.prisma.department.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        name: row.name,
        active: row.active,
      })),
    };
  }

  async createDepartment(
    userId: string,
    companyId: string,
    name: string,
  ): Promise<DepartmentDto> {
    await this.companies.requireMember(userId, companyId);
    try {
      const row = await this.prisma.department.create({
        data: { companyId, name },
      });
      return {
        id: row.id,
        companyId: row.companyId,
        name: row.name,
        active: row.active,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('That department already exists.');
      }
      throw error;
    }
  }

  async listFolders(
    userId: string,
    companyId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: FolderCatalogDto[]; total: number }> {
    await this.companies.requireMember(userId, companyId);
    const where = { companyId };
    const [total, rows] = await Promise.all([
      this.prisma.folderCatalog.count({ where }),
      this.prisma.folderCatalog.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { code: true } },
          department: { select: { name: true } },
        },
      }),
    ]);
    return {
      total,
      items: rows.map((row) => this.toFolder(row)),
    };
  }

  async resolve(
    userId: string,
    input: {
      companyId: string;
      departmentId: string;
      year: number;
      campaign: string;
      stage: FolderStageName;
      assetType: FolderAssetTypeName;
    },
  ): Promise<FolderCatalogDto> {
    const company = await this.companies.requireMember(userId, input.companyId);
    if (!isSafeSegment(company.code)) {
      throw new ConflictException('This company code cannot be used in a folder path.');
    }
    const department = await this.prisma.department.findFirst({
      where: { id: input.departmentId, companyId: input.companyId },
    });
    if (!department) {
      throw new NotFoundException('That department is not in this company.');
    }
    if (!department.active) {
      throw new ConflictException('That department is not active.');
    }
    const path = folderPath({
      companyCode: company.code,
      departmentName: department.name,
      year: input.year,
      campaign: input.campaign,
      stage: input.stage,
      assetType: input.assetType,
    });
    const existing = await this.prisma.folderCatalog.findUnique({
      where: {
        departmentId_year_campaign_stage_assetType: {
          departmentId: department.id,
          year: input.year,
          campaign: input.campaign,
          stage: input.stage,
          assetType: input.assetType,
        },
      },
      include: {
        company: { select: { code: true } },
        department: { select: { name: true } },
      },
    });
    if (existing) {
      return this.toFolder(await this.attachDrive(existing));
    }
    try {
      const created = await this.prisma.folderCatalog.create({
        data: {
          companyId: company.id,
          departmentId: department.id,
          year: input.year,
          campaign: input.campaign,
          stage: input.stage,
          assetType: input.assetType,
          path,
        },
        include: {
          company: { select: { code: true } },
          department: { select: { name: true } },
        },
      });
      return this.toFolder(await this.attachDrive(created));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const again = await this.prisma.folderCatalog.findUniqueOrThrow({
          where: {
            departmentId_year_campaign_stage_assetType: {
              departmentId: department.id,
              year: input.year,
              campaign: input.campaign,
              stage: input.stage,
              assetType: input.assetType,
            },
          },
          include: {
            company: { select: { code: true } },
            department: { select: { name: true } },
          },
        });
        return this.toFolder(await this.attachDrive(again));
      }
      throw error;
    }
  }

  private toFolder(row: FolderRow): FolderCatalogDto {
    return {
      id: row.id,
      companyId: row.companyId,
      companyCode: row.company.code,
      departmentId: row.departmentId,
      departmentName: row.department.name,
      year: row.year,
      campaign: row.campaign,
      stage: row.stage,
      assetType: row.assetType,
      path: row.path,
      driveFolderId: row.driveFolderId,
      liveCheck: 'not_run',
      detail: row.driveFolderId
        ? 'The catalog path has a Google Drive folder.'
        : this.missingDriveDetail(),
    };
  }

  private missingDriveDetail(): string {
    const missing = this.google.missingDriveSetting();
    if (!missing) {
      return NOT_CALLED;
    }
    return `${NOT_CALLED} Missing ${missing}.`;
  }

  async renameCampaign(
    userId: string,
    folderId: string,
    campaign: string,
  ): Promise<FolderCatalogDto> {
    const folder = await this.prisma.folderCatalog.findUnique({
      where: { id: folderId },
      include: {
        company: { select: { code: true } },
        department: { select: { name: true } },
      },
    });
    if (!folder) {
      throw new NotFoundException('No folder has that id.');
    }
    await this.companies.requireMember(userId, folder.companyId);
    if (!isSafeSegment(campaign)) {
      throw new ConflictException(
        'Use letters, numbers, spaces, hyphens, or underscores.',
      );
    }
    if (campaign === folder.campaign) {
      return this.toFolder(folder);
    }
    const siblings = await this.prisma.folderCatalog.findMany({
      where: {
        departmentId: folder.departmentId,
        year: folder.year,
        campaign: folder.campaign,
      },
      include: {
        company: { select: { code: true } },
        department: { select: { name: true } },
      },
    });
    if (siblings.some((row) => row.driveFolderId) && this.google.driveReady()) {
      try {
        await this.google.renameSegment(folder.path, 3, campaign);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google Drive did not rename the folder.';
        throw new ConflictException(message);
      }
    }
    try {
      await this.prisma.$transaction(
        siblings.map((row) =>
          this.prisma.folderCatalog.update({
            where: { id: row.id },
            data: {
              campaign,
              path: folderPath({
                companyCode: row.company.code,
                departmentName: row.department.name,
                year: row.year,
                campaign,
                stage: row.stage,
                assetType: row.assetType,
              }),
            },
          }),
        ),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('That campaign already exists.');
      }
      throw error;
    }
    const updated = await this.prisma.folderCatalog.findUniqueOrThrow({
      where: { id: folderId },
      include: {
        company: { select: { code: true } },
        department: { select: { name: true } },
      },
    });
    return this.toFolder(updated);
  }

  private async attachDrive(row: FolderRow): Promise<FolderRow> {
    if (row.driveFolderId || !this.google.driveReady()) {
      return row;
    }
    try {
      const driveFolderId = await this.google.ensureFolder(row.path);
      if (!driveFolderId) {
        return row;
      }
      const updated = await this.prisma.folderCatalog.update({
        where: { id: row.id },
        data: { driveFolderId },
        include: {
          company: { select: { code: true } },
          department: { select: { name: true } },
        },
      });
      await this.google.appendHistory({
        actor: 'member',
        action: 'folder_stored',
        company: updated.company.code,
        path: updated.path,
        name: updated.department.name,
        driveId: driveFolderId,
        detail: 'Folder created in Google Drive.',
      });
      return updated;
    } catch {
      return row;
    }
  }
}
