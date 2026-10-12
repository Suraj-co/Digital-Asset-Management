import { Client } from 'pg';

const adminUrl =
  process.env.ADMIN_DATABASE_URL ??
  'postgresql://dam:dam_local_dev_only@127.0.0.1:5432/dam';

const client = new Client({ connectionString: adminUrl });
await client.connect();

const existing = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = 'dam_test'",
);

if (existing.rowCount === 0) {
  await client.query('CREATE DATABASE dam_test OWNER dam');
  console.log('Created database dam_test');
} else {
  console.log('Database dam_test already exists');
}

await client.end();
