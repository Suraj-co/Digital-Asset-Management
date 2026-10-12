ALTER TYPE "AuditAction" ADD VALUE 'creator_invited';

CREATE TABLE "CreatorInvitation" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "invitedById" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreatorInvitation_tokenHash_key" ON "CreatorInvitation"("tokenHash");
CREATE INDEX "CreatorInvitation_companyId_email_idx" ON "CreatorInvitation"("companyId", "email");
CREATE INDEX "CreatorInvitation_email_idx" ON "CreatorInvitation"("email");

ALTER TABLE "CreatorInvitation" ADD CONSTRAINT "CreatorInvitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreatorInvitation" ADD CONSTRAINT "CreatorInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmailDelivery" ALTER COLUMN "notificationId" DROP NOT NULL;
ALTER TABLE "EmailDelivery" ADD COLUMN "invitationId" UUID;
CREATE UNIQUE INDEX "EmailDelivery_invitationId_key" ON "EmailDelivery"("invitationId");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "CreatorInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_one_target" CHECK (
    ("notificationId" IS NOT NULL AND "invitationId" IS NULL)
    OR ("notificationId" IS NULL AND "invitationId" IS NOT NULL)
);
