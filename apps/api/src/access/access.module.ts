import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesController } from './companies.controller.js';
import { CompaniesService } from './companies.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule, forwardRef(() => AuditModule)],
  controllers: [CompaniesController, UsersController],
  providers: [CompaniesService, UsersService],
  exports: [CompaniesService],
})
export class AccessModule {}
