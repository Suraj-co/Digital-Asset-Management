SELECT 'CREATE DATABASE dam_test OWNER dam'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dam_test')\gexec
