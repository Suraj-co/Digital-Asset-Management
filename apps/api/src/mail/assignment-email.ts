export type AssignerRole = 'rm' | 'admin';
export type TaskPriorityValue = 'low' | 'normal' | 'high';

const ASSIGNER_NAME: Record<AssignerRole, string> = {
  rm: 'Jai',
  admin: 'Aman',
};

const PRIORITY_LABEL: Record<TaskPriorityValue, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

export function assignerName(role: AssignerRole): string {
  return ASSIGNER_NAME[role];
}

export function taskViewUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/tasks`;
}

export function assignmentEmail(input: {
  role: AssignerRole;
  title: string;
  description: string;
  deadline: string | null;
  priority: TaskPriorityValue | null;
  taskUrl: string;
}): { subject: string; text: string } {
  const description = input.description.trim();
  return {
    subject: 'Task assigned',
    text: [
      `${assignerName(input.role)} has assigned you a new task.`,
      '',
      `Title: ${input.title}`,
      `Description: ${description.length > 0 ? description : 'None'}`,
      `Deadline: ${input.deadline ?? 'Not set'}`,
      `Priority: ${input.priority ? PRIORITY_LABEL[input.priority] : 'Not set'}`,
      '',
      `View the task: ${input.taskUrl}`,
    ].join('\n'),
  };
}
