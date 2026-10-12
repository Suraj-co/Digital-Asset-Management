import { Global, Module } from '@nestjs/common';
import { GoogleWorkspaceService } from './google-workspace.js';

@Global()
@Module({
  providers: [GoogleWorkspaceService],
  exports: [GoogleWorkspaceService],
})
export class GoogleModule {}
