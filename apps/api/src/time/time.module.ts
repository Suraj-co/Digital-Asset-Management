import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { TimeController } from './time.controller.js';
import { TimeService } from './time.service.js';

@Module({
  imports: [AuthModule, AccessModule, NotificationsModule, AuditModule],
  controllers: [TimeController],
  providers: [TimeService],
})
export class TimeModule {}
