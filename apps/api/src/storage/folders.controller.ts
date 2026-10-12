import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { FolderListQueryDto } from './folder-list-query.dto.js';
import { FolderCatalogDto, FolderPageDto } from './folder.types.js';
import { FoldersService } from './folders.service.js';
import { RenameFolderDto } from './rename-folder.dto.js';
import { ResolveFolderDto } from './resolve-folder.dto.js';

@ApiTags('storage')
@Controller('storage/folders')
@UseGuards(SessionGuard)
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Get()
  @ApiOperation({
    summary: 'List folder catalog rows for a company the caller belongs to',
    description:
      'driveFolderId is null. This route does not call Google.',
  })
  @ApiOkResponse({ type: FolderPageDto })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: FolderListQueryDto,
  ): Promise<FolderPageDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = await this.folders.listFolders(
      req.principal.id,
      query.companyId,
      limit,
      offset,
    );
    return { ...page, limit, offset };
  }

  @Post('resolve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Store the folder path for a company the caller belongs to',
    description:
      'The path is computed on the server. A client folder id is rejected. Google is not called, so driveFolderId stays null. Repeating the same path returns the same row.',
  })
  @ApiOkResponse({ type: FolderCatalogDto })
  resolve(
    @Req() req: AuthenticatedRequest,
    @Body() body: ResolveFolderDto,
  ): Promise<FolderCatalogDto> {
    return this.folders.resolve(req.principal.id, body);
  }

  @Patch(':folderId')
  @ApiOperation({
    summary: 'Rename the campaign folder for a company the caller belongs to',
  })
  @ApiOkResponse({ type: FolderCatalogDto })
  rename(
    @Req() req: AuthenticatedRequest,
    @Param('folderId', ParseUUIDPipe) folderId: string,
    @Body() body: RenameFolderDto,
  ): Promise<FolderCatalogDto> {
    return this.folders.renameCampaign(req.principal.id, folderId, body.campaign);
  }
}
