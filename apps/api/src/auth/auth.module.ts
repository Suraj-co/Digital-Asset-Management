import { Module } from '@nestjs/common';
import { SessionController } from './session.controller.js';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [SessionController],
  providers: [SessionService, SessionGuard],
  exports: [SessionService, SessionGuard],
})
export class AuthModule {}