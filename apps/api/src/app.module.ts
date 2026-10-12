import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AssetsModule } from './assets/assets.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { MailModule } from './mail/mail.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { GoogleModule } from './storage/google.module.js';
import { StorageModule } from './storage/storage.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { TimeModule } from './time/time.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    GoogleModule,
    MailModule,
    HealthModule,
    StorageModule,
    AuthModule,
    AccessModule,
    InvitationsModule,
    AssetsModule,
    TasksModule,
    TimeModule,
    DashboardModule,
    NotificationsModule,
    AuditModule,
  ],
})
export class AppModule {}
