export const WORKFLOW_STAGES = [
  'draft',
  'scope_analysis',
  'rm_qc',
  'rm_approval',
  'admin_qc',
  'admin_approval',
  'changes_requested',
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];
export type PublicationStatus = 'not_started' | 'not_run' | 'ready';
export type WorkflowActionName = 'submit' | 'approve' | 'reject' | 'publish';

export const PUBLICATION_FAILURE =
  'Google Drive was not called. The file was not moved into 02_Approved.';

const STAGE_ROLE: Record<WorkflowStage, 'creator' | 'rm' | 'admin'> = {
  draft: 'creator',
  scope_analysis: 'rm',
  rm_qc: 'rm',
  rm_approval: 'rm',
  admin_qc: 'admin',
  admin_approval: 'admin',
  changes_requested: 'creator',
};

const APPROVE_NEXT: Partial<Record<WorkflowStage, WorkflowStage>> = {
  scope_analysis: 'rm_qc',
  rm_qc: 'rm_approval',
  rm_approval: 'admin_qc',
  admin_qc: 'admin_approval',
};

export function allowedActions(
  stage: WorkflowStage,
  publication: PublicationStatus,
  roles: readonly string[],
): WorkflowActionName[] {
  if (!roles.includes(STAGE_ROLE[stage])) {
    return [];
  }
  if (stage === 'draft') {
    return ['submit'];
  }
  if (stage === 'changes_requested') {
    return [];
  }
  if (stage === 'admin_approval' && publication === 'ready') {
    return ['reject'];
  }
  if (stage === 'admin_approval' && publication === 'not_run') {
    return ['publish', 'reject'];
  }
  return ['approve', 'reject'];
}

export type PlannedTransition = {
  action: WorkflowActionName;
  toStage: WorkflowStage;
  publication: PublicationStatus;
  detail: string;
};

export function planTransition(input: {
  action: WorkflowActionName;
  stage: WorkflowStage;
  publication: PublicationStatus;
  roles: readonly string[];
  reason: string | null;
}): PlannedTransition | { status: 400 | 403 | 409; message: string } {
  if (input.action === 'reject' && !input.reason) {
    return { status: 400, message: 'Enter a reason for the rejection.' };
  }
  if (input.action !== 'reject' && input.reason) {
    return { status: 400, message: 'A reason is only recorded for a rejection.' };
  }
  if (!input.roles.includes(STAGE_ROLE[input.stage])) {
    return { status: 403, message: 'You cannot decide this stage.' };
  }
  if (input.action === 'submit') {
    if (input.stage !== 'draft') {
      return { status: 409, message: 'This asset is not a draft.' };
    }
    return {
      action: 'submit',
      toStage: 'scope_analysis',
      publication: 'not_started',
      detail: 'Submitted the latest version. The file is not stored.',
    };
  }
  if (input.action === 'publish') {
    if (input.stage !== 'admin_approval' || input.publication === 'ready') {
      return {
        status: 409,
        message: 'This asset is ready to publish.',
      };
    }
    if (input.publication !== 'not_run') {
      return {
        status: 409,
        message: 'Approve this stage before it is ready to publish.',
      };
    }
    return {
      action: 'publish',
      toStage: 'admin_approval',
      publication: 'ready',
      detail: 'Ready to publish.',
    };
  }
  if (input.action === 'reject') {
    if (input.stage === 'draft' || input.stage === 'changes_requested') {
      return { status: 409, message: 'This asset is not in review.' };
    }
    return {
      action: 'reject',
      toStage: 'changes_requested',
      publication: 'not_started',
      detail: 'Rejected. The file is not stored.',
    };
  }
  if (input.stage === 'admin_approval' && (input.publication === 'not_run' || input.publication === 'ready')) {
    return {
      status: 409,
      message: 'This asset is ready to publish.',
    };
  }
  const next = APPROVE_NEXT[input.stage];
  if (next) {
    return {
      action: 'approve',
      toStage: next,
      publication: 'not_started',
      detail: 'Approved this stage. The file is not stored.',
    };
  }
  if (input.stage === 'admin_approval') {
    return {
      action: 'approve',
      toStage: 'admin_approval',
      publication: 'ready',
      detail: 'Ready to publish.',
    };
  }
  return { status: 409, message: 'This asset is not waiting for that decision.' };
}
