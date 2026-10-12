import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DepartmentsController } from './departments.controller.js';
import { FoldersController } from './folders.controller.js';
import { FoldersService } from './folders.service.js';
import { DriveOauthController } from './drive-oauth.controller.js';
import { StorageConnectionController } from './storage-connection.controller.js';
import { StorageConnectionService } from './storage-connection.service.js';

@Module({
  imports: [AuthModule, AccessModule],
  controllers: [
    StorageConnectionController,
    DriveOauthController,
    DepartmentsController,
    FoldersController,
  ],
  providers: [StorageConnectionService, FoldersService],
})
export class StorageModule {}
