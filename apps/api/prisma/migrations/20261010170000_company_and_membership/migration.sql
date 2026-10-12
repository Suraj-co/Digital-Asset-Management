-- Module 4. Five companies and memberships. No department or asset tables.
-- Company names match the codes. No separate legal name was specified.

CREATE TYPE "MembershipRole" AS ENUM ('creator', 'rm', 'admin');

CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Membership_userId_companyId_role_key" ON "Membership"("userId", "companyId", "role");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE INDEX "Membership_companyId_idx" ON "Membership"("companyId");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Company" ("id", "code", "name", "active") VALUES
    ('4b4c0001-0000-4000-8000-000000000001', 'BAPL', 'BAPL', true),
    ('4b4c0002-0000-4000-8000-000000000002', 'SAPL', 'SAPL', true),
    ('4b4c0003-0000-4000-8000-000000000003', 'GBAPL', 'GBAPL', true),
    ('4b4c0004-0000-4000-8000-000000000004', 'KABPL', 'KABPL', true),
    ('4b4c0005-0000-4000-8000-000000000005', 'Ontale', 'Ontale', true);
