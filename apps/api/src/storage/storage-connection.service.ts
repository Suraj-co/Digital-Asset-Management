import { Injectable } from '@nestjs/common';
import {
  readDriveConfiguration,
  type DriveSettingName,
} from './drive-settings.js';
import type { StorageConnectionDto } from './storage-connection.types.js';

function detailFor(
  status: 'not_configured' | 'configured',
  missing: DriveSettingName[],
): string {
  if (status === 'not_configured') {
    return 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. The redirect URI has a local default. This response did not call Google.';
  }
  if (missing.includes('GOOGLE_DRIVE_ID')) {
    return 'The Google client id and secret are set. GOOGLE_DRIVE_ID is not set. This response did not call Google, so no shared drive was opened.';
  }
  return 'Credentials are present. This response did not call Google, so the shared drive is not verified.';
}

@Injectable()
export class StorageConnectionService {
  report(
    correlationId: string,
    source: NodeJS.ProcessEnv = process.env,
  ): StorageConnectionDto {
    const configuration = readDriveConfiguration(source);
    return {
      status: configuration.status,
      provider: 'google_drive',
      missing: configuration.missing,
      liveCheck: 'not_run',
      detail: detailFor(configuration.status, configuration.missing),
      timestamp: new Date().toISOString(),
      correlationId,
    };
  }
}
