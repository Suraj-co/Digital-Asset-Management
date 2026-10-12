import { config } from 'dotenv';
import { resolve } from 'node:path';

export function loadLocalEnvFile(): void {
  config({ path: resolve(process.cwd(), '.env') });
  config({ path: resolve(process.cwd(), '../../.env') });
}
