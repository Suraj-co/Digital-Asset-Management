-- Company hourly rate for accepted minutes, and an email copy of an in-app notice.

ALTER TABLE "Company" ADD COLUMN "hourlyRateMinor" INTEGER;
ALTER TABLE "Company" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR';

ALTER TYPE "AuditAction" ADD VALUE 'pay_rate_set';

CREATE TYPE "EmailStatus" AS ENUM ('pending', 'queued', 'held', 'sent', 'failed');

CREATE TABLE "EmailDelivery" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'pending',
    "detail" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDelivery_notificationId_key" ON "EmailDelivery"("notificationId");
CREATE INDEX "EmailDelivery_status_idx" ON "EmailDelivery"("status");

ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
