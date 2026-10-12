import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';
import { DriveCleanupService } from './drive-cleanup.service.js';

@Module({
  imports: [AuthModule, AccessModule, NotificationsModule, AuditModule],
  controllers: [AssetsController],
  providers: [AssetsService, DriveCleanupService],
})
export class AssetsModule {}