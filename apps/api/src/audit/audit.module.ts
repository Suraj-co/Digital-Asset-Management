import { forwardRef, Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [AuthModule, forwardRef(() => AccessModule)],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
