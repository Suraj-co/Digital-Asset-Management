export const TASK_STAGES = [
  'draft',
  'assigned',
  'in_progress',
  'submitted_rm_qc',
  'rm_approved',
  'submitted_admin_qc',
  'admin_approved',
  'ready_to_publish',
  'completed',
  'changes_requested',
] as const;

export type TaskStage = (typeof TASK_STAGES)[number];

export const TASK_ACTIONS = ['start', 'submit', 'approve', 'reject', 'complete', 'resubmit'] as const;

export type TaskAction = (typeof TASK_ACTIONS)[number];

export const TASK_STAGE_LABEL: Record<TaskStage, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted_rm_qc: 'Submitted for RM QC',
  rm_approved: 'RM approved',
  submitted_admin_qc: 'Submitted for Admin QC',
  admin_approved: 'Admin approved',
  ready_to_publish: 'Ready to publish',
  completed: 'Completed',
  changes_requested: 'Changes requested',
};

type Refusal = { status: 400 | 403 | 409; message: string };
type Planned = { to: TaskStage; detail: string };

const RM_STAGES: TaskStage[] = ['submitted_rm_qc', 'rm_approved'];
const ADMIN_STAGES: TaskStage[] = ['submitted_admin_qc', 'admin_approved', 'ready_to_publish'];

export function planTaskTransition(input: {
  action: TaskAction;
  stage: TaskStage;
  roles: readonly string[];
  isAssignee: boolean;
  isResponsible: boolean;
  reason: string | null;
}): Refusal | Planned {
  const reason = input.reason?.trim() ?? '';
  if (input.action === 'reject' && reason.length === 0) {
    return { status: 400, message: 'A comment is required to reject this task.' };
  }
  if (input.action === 'start') {
    return move(input, input.isAssignee, 'assigned', 'in_progress', 'Only the assignee can start this task.');
  }
  if (input.action === 'submit') {
    return move(
      input,
      input.isAssignee,
      'in_progress',
      'submitted_rm_qc',
      'Only the assignee can submit this task.',
    );
  }
  if (input.action === 'resubmit') {
    return move(
      input,
      input.isAssignee,
      'changes_requested',
      'submitted_rm_qc',
      'Only the assignee can resubmit this task.',
    );
  }
  if (input.action === 'complete') {
    if (!input.roles.includes('admin')) {
      return { status: 403, message: 'Only an admin can complete this task.' };
    }
    return move(input, true, 'ready_to_publish', 'completed', 'Only an admin can complete this task.');
  }
  if (input.action === 'reject') {
    if (RM_STAGES.includes(input.stage)) {
      if (!input.isResponsible) {
        return { status: 403, message: 'Only the responsible RM can reject this task.' };
      }
      return { to: 'changes_requested', detail: reason };
    }
    if (ADMIN_STAGES.includes(input.stage)) {
      if (!input.roles.includes('admin')) {
        return { status: 403, message: 'Only an admin can reject this task.' };
      }
      return { to: 'changes_requested', detail: reason };
    }
    return { status: 409, message: 'This task is not waiting for that decision.' };
  }
  if (input.stage === 'submitted_rm_qc' && input.isResponsible) {
    return { to: 'rm_approved', detail: 'RM approved.' };
  }
  if (input.stage === 'rm_approved' && input.isResponsible) {
    return { to: 'submitted_admin_qc', detail: 'Submitted for admin QC.' };
  }
  if (input.stage === 'submitted_admin_qc' && input.roles.includes('admin')) {
    return { to: 'admin_approved', detail: 'Admin approved.' };
  }
  if (input.stage === 'admin_approved' && input.roles.includes('admin')) {
    return { to: 'ready_to_publish', detail: 'Ready to publish.' };
  }
  if (RM_STAGES.includes(input.stage) && !input.isResponsible) {
    return { status: 403, message: 'Only the responsible RM can approve this task.' };
  }
  if (ADMIN_STAGES.includes(input.stage) && !input.roles.includes('admin')) {
    return { status: 403, message: 'Only an admin can approve this task.' };
  }
  if (ADMIN_STAGES.includes(input.stage) && input.isResponsible && !input.roles.includes('admin')) {
    return { status: 403, message: 'Only an admin can approve this task.' };
  }
  return { status: 409, message: 'This task is not waiting for that decision.' };
}

function move(
  input: { action: TaskAction; stage: TaskStage },
  allowed: boolean,
  from: TaskStage,
  to: TaskStage,
  denied: string,
): Refusal | Planned {
  if (input.stage !== from) {
    return { status: 409, message: 'This task is not waiting for that decision.' };
  }
  if (!allowed) {
    return { status: 403, message: denied };
  }
  return { to, detail: TASK_STAGE_LABEL[to] };
}

export function taskActions(input: {
  stage: TaskStage;
  roles: readonly string[];
  isAssignee: boolean;
  isResponsible: boolean;
}): TaskAction[] {
  return TASK_ACTIONS.filter((action) => {
    const planned = planTaskTransition({
      action,
      stage: input.stage,
      roles: input.roles,
      isAssignee: input.isAssignee,
      isResponsible: input.isResponsible,
      reason: action === 'reject' ? 'Changes.' : null,
    });
    return !('status' in planned);
  });
}
