-- Module 10. A task is a plan inside one company. It does not record time.

CREATE TYPE "TaskStatus" AS ENUM ('open', 'done');

CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskAssignment" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskLink" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_companyId_idx" ON "Task"("companyId");
CREATE UNIQUE INDEX "TaskAssignment_taskId_userId_key" ON "TaskAssignment"("taskId", "userId");
CREATE INDEX "TaskAssignment_userId_idx" ON "TaskAssignment"("userId");
CREATE UNIQUE INDEX "TaskLink_taskId_assetId_key" ON "TaskLink"("taskId", "assetId");
CREATE INDEX "TaskLink_assetId_idx" ON "TaskLink"("assetId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskLink" ADD CONSTRAINT "TaskLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskLink" ADD CONSTRAINT "TaskLink_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
