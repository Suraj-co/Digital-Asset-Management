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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { CreateTaskDto } from './create-task.dto.js';
import { TaskListQueryDto } from './task-list-query.dto.js';
import { MAX_UPLOAD_BYTES } from '../assets/upload-file.js';
import { CreateTaskCommentDto, TaskTransitionDto } from './task-transition.dto.js';
import { TaskDetailDto, TaskDto, TaskPageDto } from './task.types.js';
import { TasksService } from './tasks.service.js';
import { UpdateTaskDto } from './update-task.dto.js';

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(SessionGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({
    summary: 'List tasks in companies the caller belongs to',
    description:
      'A task is a plan. It does not record time or store a file. Assigning someone else writes an in-app notice and an email copy.',
  })
  @ApiOkResponse({ type: TaskPageDto })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: TaskListQueryDto,
  ): Promise<TaskPageDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = await this.tasks.list(
      req.principal.id,
      query.companyId,
      query.departmentId,
      limit,
      offset,
    );
    return { ...page, limit, offset };
  }

  @Get(':taskId')
  @ApiOperation({
    summary: 'Read one task',
    description: 'A task in another company is 403. An unknown id is 404.',
  })
  @ApiOkResponse({ type: TaskDetailDto })
  get(
    @Req() req: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<TaskDetailDto> {
    return this.tasks.get(req.principal.id, taskId);
  }

  @Post(':taskId/transitions')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Move a task through the review stages',
    description:
      'Draft, assigned, in progress, RM QC, admin QC, ready to publish, and completed stay on the same task. The caller role and the current stage decide the next step.',
  })
  @ApiOkResponse({ type: TaskDetailDto })
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: TaskTransitionDto,
  ): Promise<TaskDetailDto> {
    return this.tasks.transition(req.principal.id, taskId, body.action, body.reason ?? null);
  }

  @Post(':taskId/comments')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a comment to a task the caller can see' })
  @ApiOkResponse({ type: TaskDetailDto })
  comment(
    @Req() req: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: CreateTaskCommentDto,
  ): Promise<TaskDetailDto> {
    return this.tasks.comment(req.principal.id, taskId, body.body);
  }

  @Post(':taskId/files')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiOperation({
    summary: 'Attach a file to a task the caller can see',
    description: 'The file is stored in Google Drive when Drive is ready. The task row stays in PostgreSQL.',
  })
  @ApiOkResponse({ type: TaskDetailDto })
  addFile(
    @Req() req: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
  ): Promise<TaskDetailDto> {
    return this.tasks.addFile(
      req.principal.id,
      taskId,
      file
        ? {
            name: file.originalname,
            contentType: file.mimetype || 'application/octet-stream',
            byteSize: file.size,
            bytes: file.buffer,
          }
        : undefined,
    );
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Plan a task in a company the caller belongs to',
    description:
      'The assignee must already belong to that company. The asset must belong to that company. Assigning someone else writes an in-app notice and an email copy.',
  })
  @ApiOkResponse({ type: TaskDto })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateTaskDto,
  ): Promise<TaskDto> {
    return this.tasks.create(req.principal.id, {
      companyId: body.companyId,
      title: body.title,
      detail: body.detail,
      assetId: body.assetId,
      assigneeEmail: body.assigneeEmail,
      deadline: body.deadline,
      priority: body.priority,
    });
  }

  @Patch(':taskId')
  @ApiOperation({
    summary: 'Change a task in a company the caller belongs to',
    description:
      'Status is open or done. A null asset or assignee clears that link. Time is not recorded.',
  })
  @ApiOkResponse({ type: TaskDto })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.tasks.update(req.principal.id, taskId, {
      title: body.title,
      detail: body.detail,
      status: body.status,
      assetId: body.assetId,
      assigneeEmail: body.assigneeEmail,
      deadline: body.deadline,
      priority: body.priority,
    });
  }
}
