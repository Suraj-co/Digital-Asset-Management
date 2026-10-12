-- Create a new enum so the stage can be stored in this migration.
CREATE TYPE "TaskStage" AS ENUM (
  'draft',
  'assigned',
  'in_progress',
  'submitted_rm_qc',
  'rm_approved',
  'submitted_admin_qc',
  'admin_approved',
  'ready_to_publish',
  'completed',
  'changes_requested'
);

ALTER TABLE "Task" ADD COLUMN "stage" "TaskStage" NOT NULL DEFAULT 'draft';
ALTER TABLE "Task" ADD COLUMN "departmentId" UUID;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Task_departmentId_idx" ON "Task"("departmentId");

CREATE TABLE "TaskComment" (
  "id" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");

ALTER TABLE "TaskComment"
  ADD CONSTRAINT "TaskComment_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskComment"
  ADD CONSTRAINT "TaskComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TaskFile" (
  "id" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "fileName" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "contentType" TEXT NOT NULL,
  "driveFileId" TEXT,
  "detail" TEXT NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskFile_taskId_idx" ON "TaskFile"("taskId");

ALTER TABLE "TaskFile"
  ADD CONSTRAINT "TaskFile_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskFile"
  ADD CONSTRAINT "TaskFile_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "NotificationKind" ADD VALUE 'task_updated';
