CREATE TYPE "TaskPriority" AS ENUM ('low', 'normal', 'high');

ALTER TABLE "Task" ADD COLUMN "deadline" DATE;
ALTER TABLE "Task" ADD COLUMN "priority" "TaskPriority";
