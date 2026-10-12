-- Module 11. Minutes a person entered. Review does not invent a total.

CREATE TYPE "TimeEntryStatus" AS ENUM ('open', 'submitted', 'accepted', 'returned');

CREATE TABLE "TimeEntry" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID,
    "workDate" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'open',
    "reviewReason" TEXT,
    "reviewedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimeEntry_companyId_idx" ON "TimeEntry"("companyId");
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");

ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
