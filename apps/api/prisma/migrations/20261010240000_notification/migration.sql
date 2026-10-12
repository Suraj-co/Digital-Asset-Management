-- Module 13. An in-app notice. No email is sent.

CREATE TYPE "NotificationKind" AS ENUM ('task_assigned', 'time_returned', 'asset_rejected');

CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
