import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { correlationIdFrom } from '../http/request-context.js';
import { StorageConnectionService } from './storage-connection.service.js';
import { StorageConnectionDto } from './storage-connection.types.js';

@ApiTags('storage')
@Controller('storage')
export class StorageConnectionController {
  constructor(private readonly connection: StorageConnectionService) {}

  @Get('connection')
  @ApiOperation({
    summary: 'Google Drive configuration report',
    description:
      'Says whether the four Drive settings are present. HTTP 200 in both cases. This route does not call Google and does not change readiness.',
  })
  @ApiOkResponse({ type: StorageConnectionDto })
  connectionReport(@Req() req: Request): StorageConnectionDto {
    return this.connection.report(correlationIdFrom(req));
  }
}
