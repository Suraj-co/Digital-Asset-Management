import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { AssetListQueryDto } from './asset-list-query.dto.js';
import { AssetDto, AssetPageDto } from './asset.types.js';
import { AssetsService } from './assets.service.js';
import { GoogleWorkspaceService } from '../storage/google-workspace.js';
import { CreateAssetDto } from './create-asset.dto.js';
import { TransitionAssetDto } from './transition-asset.dto.js';
import { UpdateAssetDto } from './update-asset.dto.js';
import {
  MAX_UPLOAD_BYTES,
  readIdempotencyKey,
  readUploadMeta,
} from './upload-file.js';

type Uploaded = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

@ApiTags('assets')
@Controller('assets')
@UseGuards(SessionGuard)
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly google: GoogleWorkspaceService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List assets in companies the caller belongs to',
    description:
      'Optional q matches code, title, or file name. File contents are not searched. No file bytes and no Drive file id are returned.',
  })
  @ApiOkResponse({ type: AssetPageDto })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: AssetListQueryDto,
  ): Promise<AssetPageDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = await this.assets.list(
      req.principal.id,
      query.companyId,
      limit,
      offset,
      query.q,
      query.folderId,
    );
    return { ...page, limit, offset };
  }

  @Get(':assetId')
  @ApiOperation({
    summary: 'Read one asset',
    description: 'An asset in another company is 403. An unknown id is 404.',
  })
  @ApiOkResponse({ type: AssetDto })
  get(
    @Req() req: AuthenticatedRequest,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ): Promise<AssetDto> {
    return this.assets.get(req.principal.id, assetId);
  }

  @Get(':assetId/file')
  @ApiOperation({
    summary: 'Download or preview a file stored in Google Drive',
    description:
      'The caller must belong to the asset company. The response is the file bytes. OAuth tokens are not included.',
  })
  async download(
    @Req() req: AuthenticatedRequest,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Query('disposition') disposition: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.assets.openFile(req.principal.id, assetId);
    const kind = disposition === 'inline' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', contentDisposition(kind, file.fileName));
    res.send(file.bytes);
  }

  @Delete(':assetId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a file the caller can access',
    description:
      'Trashes the Google Drive file when one is stored, then removes the metadata. A file in another company is 403.',
  })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ): Promise<void> {
    return this.assets.remove(req.principal.id, assetId);
  }

  @Patch(':assetId')
  @ApiOperation({
    summary: 'Change an asset title',
    description:
      'Only the title is writable. The file, the company, and the Drive id stay as they are. There is still no stored file.',
  })
  @ApiOkResponse({ type: AssetDto })
  updateTitle(
    @Req() req: AuthenticatedRequest,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() body: UpdateAssetDto,
  ): Promise<AssetDto> {
    return this.assets.updateTitle(req.principal.id, assetId, body.title);
  }

  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiOperation({
    summary: 'Record an upload that cannot be stored yet',
    description:
      'The file is read for its name and size, then discarded. Google Drive is not called. driveFileId is null. Repeat the same Idempotency-Key to receive the same asset.',
  })
  @ApiOkResponse({ type: AssetDto })
  create(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Uploaded | undefined,
    @Body() body: CreateAssetDto,
  ): Promise<AssetDto> {
    const meta = this.meta(file);
    const idempotencyKey = this.idempotency(req.header('idempotency-key'));
    const bytes = this.google.driveReady() ? file?.buffer : undefined;
    if (file) {
      file.buffer = undefined;
    }
    return this.assets.create(req.principal.id, {
      folderId: body.folderId,
      title: body.title,
      file: { ...meta, bytes },
      idempotencyKey,
    });
  }

  @Post(':assetId/content')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiOperation({
    summary: 'Retry a failed upload',
    description:
      'Replaces the latest version’s recorded name and size. Earlier versions stay. Google Drive is still not called.',
  })
  @ApiOkResponse({ type: AssetDto })
  retry(
    @Req() req: AuthenticatedRequest,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @UploadedFile() file: Uploaded | undefined,
  ): Promise<AssetDto> {
    const meta = this.meta(file);
    const bytes = this.google.driveReady() ? file?.buffer : undefined;
    if (file) {
      file.buffer = undefined;
    }
    return this.assets.retry(req.principal.id, assetId, { ...meta, bytes });
  }

  @Post(':assetId/transitions')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record a review decision',
    description:
      'The caller must hold the role for the current stage. Rejection requires a reason. Admin approval does not move a file. Google Drive is not called, so publication stays not_run.',
  })
  @ApiOkResponse({ type: AssetDto })
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() body: TransitionAssetDto,
  ): Promise<AssetDto> {
    return this.assets.transition(req.principal.id, assetId, {
      action: body.action,
      reason: body.reason ?? null,
    });
  }

  @Post(':assetId/versions')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiOperation({
    summary: 'Record another version of the same asset',
    description:
      'Keeps the asset id and the earlier version rows. The new file is discarded. Google Drive is not called, so driveFileId stays null.',
  })
  @ApiOkResponse({ type: AssetDto })
  addVersion(
    @Req() req: AuthenticatedRequest,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @UploadedFile() file: Uploaded | undefined,
  ): Promise<AssetDto> {
    const meta = this.meta(file);
    const idempotencyKey = this.idempotency(req.header('idempotency-key'));
    const bytes = this.google.driveReady() ? file?.buffer : undefined;
    if (file) {
      file.buffer = undefined;
    }
    return this.assets.addVersion(req.principal.id, assetId, { ...meta, bytes }, idempotencyKey);
  }

  private meta(file: Uploaded | undefined) {
    const meta = readUploadMeta(file);
    if (!meta) {
      throw new BadRequestException(
        'Choose a file of 20 MB or less with a plain file name.',
      );
    }
    return meta;
  }

  private idempotency(value: string | undefined): string | null {
    const key = readIdempotencyKey(value);
    if (!key.ok) {
      throw new BadRequestException(
        'Idempotency-Key must be letters, numbers, dots, underscores, colons, or hyphens.',
      );
    }
    return key.key;
  }
}

function contentDisposition(kind: 'inline' | 'attachment', fileName: string): string {
  const safe = fileName.replace(/[\r\n"]/g, '_').slice(0, 180);
  return `${kind}; filename="${safe}"`;
}
