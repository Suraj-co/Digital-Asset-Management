import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { TASK_ACTIONS } from './task-workflow.js';

export class TaskTransitionDto {
  @IsIn(TASK_ACTIONS)
  action!: (typeof TASK_ACTIONS)[number];

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateTaskCommentDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
}
