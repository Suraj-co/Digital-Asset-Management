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
import { CreateTimeEntryDto } from './create-time-entry.dto.js';
import { ReviewTimeEntryDto } from './review-time-entry.dto.js';
import { TimeListQueryDto } from './time-list-query.dto.js';
import { TimeEntryDto, TimeEntryPageDto } from './time.types.js';
import { TimeService } from './time.service.js';
import { UpdateTimeEntryDto } from './update-time-entry.dto.js';

@ApiTags('time')
@Controller('time-entries')
@UseGuards(SessionGuard)
export class TimeController {
  constructor(private readonly time: TimeService) {}

  @Get()
  @ApiOperation({
    summary: 'List time entries the caller is allowed to see',
    description:
      'A creator sees their own entries. An RM or admin sees every entry in that company. Minutes are the number that was entered.',
  })
  @ApiOkResponse({ type: TimeEntryPageDto })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: TimeListQueryDto,
  ): Promise<TimeEntryPageDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = await this.time.list(req.principal.id, query.companyId, limit, offset);
    return { ...page, limit, offset };
  }

  @Get(':entryId')
  @ApiOperation({
    summary: 'Read one time entry',
    description: 'Another company is 403. A creator cannot read a teammate\'s entry. An unknown id is 404.',
  })
  @ApiOkResponse({ type: TimeEntryDto })
  get(
    @Req() req: AuthenticatedRequest,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ): Promise<TimeEntryDto> {
    return this.time.get(req.principal.id, entryId);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Record the caller\'s minutes for one company',
    description:
      'The entry starts open. Minutes are 1 to 720. The work date cannot be in the future. An optional task must belong to the same company.',
  })
  @ApiOkResponse({ type: TimeEntryDto })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateTimeEntryDto,
  ): Promise<TimeEntryDto> {
    return this.time.create(req.principal.id, {
      companyId: body.companyId,
      workDate: body.workDate,
      minutes: body.minutes,
      note: body.note,
      taskId: body.taskId,
    });
  }

  @Patch(':entryId')
  @ApiOperation({
    summary: 'Correct an open or returned entry',
    description: 'Only the person who recorded it can change it, and only while it is open or returned.',
  })
  @ApiOkResponse({ type: TimeEntryDto })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: UpdateTimeEntryDto,
  ): Promise<TimeEntryDto> {
    return this.time.update(req.principal.id, entryId, {
      workDate: body.workDate,
      minutes: body.minutes,
      note: body.note,
      taskId: body.taskId,
    });
  }

  @Post(':entryId/review')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Submit, accept, or return a time entry',
    description:
      'The owner submits. An RM or admin accepts or returns a submitted entry. A return requires a reason and writes an in-app notice when the reviewer is someone else. An email copy is queued. The payroll total is accepted minutes on the dashboard.',
  })
  @ApiOkResponse({ type: TimeEntryDto })
  review(
    @Req() req: AuthenticatedRequest,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: ReviewTimeEntryDto,
  ): Promise<TimeEntryDto> {
    return this.time.review(req.principal.id, entryId, {
      action: body.action,
      reason: body.reason ?? null,
    });
  }
}
