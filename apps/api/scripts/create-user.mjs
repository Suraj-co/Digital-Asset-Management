import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

// Hash parameters must match apps/api/src/auth/password.ts.
const scrypt = promisify(scryptCallback);
const email = process.env.CREATE_USER_EMAIL?.trim().toLowerCase();
const password = process.env.CREATE_USER_PASSWORD;

if (!email || !password) {
  console.error('Set CREATE_USER_EMAIL and CREATE_USER_PASSWORD.');
  process.exit(1);
}
if (password.length < 12) {
  console.error('CREATE_USER_PASSWORD must be at least 12 characters.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 });
const passwordHash = [
  'scrypt',
  '16384',
  '8',
  '1',
  salt.toString('base64'),
  hash.toString('base64'),
].join('$');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await client.query(
    `INSERT INTO "User" (id, email, "passwordHash", status, "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, 'active', NOW())
     ON CONFLICT (email)
     DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", status = 'active', "updatedAt" = NOW()
     RETURNING id, email, status`,
    [email, passwordHash],
  );
  console.log(JSON.stringify(result.rows[0]));
} finally {
  await client.end();
}
