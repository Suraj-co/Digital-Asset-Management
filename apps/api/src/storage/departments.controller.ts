import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { PageQueryDto } from '../http/page-query.dto.js';
import { CreateDepartmentDto } from './create-department.dto.js';
import { DepartmentDto, DepartmentPageDto } from './folder.types.js';
import { FoldersService } from './folders.service.js';

@ApiTags('companies')
@Controller('companies/:companyId/departments')
@UseGuards(SessionGuard)
export class DepartmentsController {
  constructor(private readonly folders: FoldersService) {}

  @Get()
  @ApiOperation({
    summary: 'List departments in a company the caller belongs to',
  })
  @ApiOkResponse({ type: DepartmentPageDto })
  async list(
    @Req() req: AuthenticatedRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: PageQueryDto,
  ): Promise<DepartmentPageDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = await this.folders.listDepartments(
      req.principal.id,
      companyId,
      limit,
      offset,
    );
    return { ...page, limit, offset };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Add a department in a company the caller belongs to',
  })
  @ApiOkResponse({ type: DepartmentDto })
  create(
    @Req() req: AuthenticatedRequest,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() body: CreateDepartmentDto,
  ): Promise<DepartmentDto> {
    return this.folders.createDepartment(req.principal.id, companyId, body.name);
  }
}
