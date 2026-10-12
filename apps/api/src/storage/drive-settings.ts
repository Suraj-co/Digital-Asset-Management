import { z } from 'zod';

export const DRIVE_SETTING_NAMES = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'GOOGLE_DRIVE_ID',
] as const;

export type DriveSettingName = (typeof DRIVE_SETTING_NAMES)[number];

export const DEFAULT_GOOGLE_REDIRECT_URI =
  'http://127.0.0.1:43124/api/v1/storage/oauth/callback';

export type DriveConfiguration = {
  status: 'not_configured' | 'configured';
  missing: DriveSettingName[];
};

function blankToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}

const optionalText = z.preprocess(
  blankToUndefined,
  z.string().trim().min(1).optional(),
);

const driveSchema = z.object({
  GOOGLE_CLIENT_ID: optionalText,
  GOOGLE_CLIENT_SECRET: optionalText,
  GOOGLE_REDIRECT_URI: z.preprocess(blankToUndefined, z.url().optional()),
  GOOGLE_DRIVE_ID: optionalText,
});

export function readDriveConfiguration(
  source: NodeJS.ProcessEnv,
): DriveConfiguration {
  const parsed = driveSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }

  const clientId = parsed.data.GOOGLE_CLIENT_ID;
  const clientSecret = parsed.data.GOOGLE_CLIENT_SECRET;
  const driveId = parsed.data.GOOGLE_DRIVE_ID;
  const redirect = parsed.data.GOOGLE_REDIRECT_URI;
  const anySet = Boolean(clientId || clientSecret || driveId || redirect);

  if (!anySet) {
    return {
      status: 'not_configured',
      missing: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    };
  }

  const missingPair: DriveSettingName[] = [];
  if (!clientId) {
    missingPair.push('GOOGLE_CLIENT_ID');
  }
  if (!clientSecret) {
    missingPair.push('GOOGLE_CLIENT_SECRET');
  }
  if (missingPair.length > 0) {
    throw new Error(
      `Invalid environment: ${missingPair.join(', ')}: required when any Google Drive setting is set`,
    );
  }

  return {
    status: 'configured',
    missing: driveId ? [] : ['GOOGLE_DRIVE_ID'],
  };
}
