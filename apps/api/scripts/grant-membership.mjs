import pg from 'pg';

const email = process.env.GRANT_MEMBERSHIP_EMAIL?.trim().toLowerCase();
const code = process.env.GRANT_MEMBERSHIP_COMPANY?.trim();
const role = process.env.GRANT_MEMBERSHIP_ROLE?.trim();
const roles = new Set(['creator', 'rm', 'admin']);

if (!email || !code || !role) {
  console.error(
    'Set GRANT_MEMBERSHIP_EMAIL, GRANT_MEMBERSHIP_COMPANY, and GRANT_MEMBERSHIP_ROLE.',
  );
  process.exit(1);
}
if (!roles.has(role)) {
  console.error('GRANT_MEMBERSHIP_ROLE must be creator, rm, or admin.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const user = await client.query(
    'SELECT id, email, status FROM "User" WHERE email = $1',
    [email],
  );
  if (user.rowCount !== 1) {
    console.error('No user has that email. Create the account first.');
    process.exit(1);
  }
  const company = await client.query(
    'SELECT id, code FROM "Company" WHERE code = $1',
    [code],
  );
  if (company.rowCount !== 1) {
    console.error('No company has that code.');
    process.exit(1);
  }
  const inserted = await client.query(
    `INSERT INTO "Membership" (id, "userId", "companyId", role)
     VALUES (gen_random_uuid(), $1, $2, $3::"MembershipRole")
     ON CONFLICT ("userId", "companyId", role) DO NOTHING
     RETURNING id`,
    [user.rows[0].id, company.rows[0].id, role],
  );
  const membership =
    inserted.rowCount === 1
      ? inserted.rows[0]
      : (
          await client.query(
            `SELECT id FROM "Membership"
             WHERE "userId" = $1 AND "companyId" = $2 AND role = $3::"MembershipRole"`,
            [user.rows[0].id, company.rows[0].id, role],
          )
        ).rows[0];
  console.log(
    JSON.stringify({
      id: membership.id,
      email: user.rows[0].email,
      status: user.rows[0].status,
      company: company.rows[0].code,
      role,
      created: inserted.rowCount === 1,
    }),
  );
} finally {
  await client.end();
}
