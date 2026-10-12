import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (error, derived) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derived);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt);
  return [
    'scrypt',
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallel = Number(parts[3]);
  if (
    cost !== SCRYPT_N ||
    blockSize !== SCRYPT_R ||
    parallel !== SCRYPT_P
  ) {
    return false;
  }
  const salt = Buffer.from(parts[4] ?? '', 'base64');
  const expected = Buffer.from(parts[5] ?? '', 'base64');
  if (salt.length === 0 || expected.length !== KEY_LENGTH) {
    return false;
  }
  const actual = await scryptAsync(password, salt);
  return timingSafeEqual(actual, expected);
}
