import { describe, expect, it } from 'vitest';
import { planTaskTransition, taskActions } from './task-workflow.js';

const assignee = { roles: ['creator'] as const, isAssignee: true, isResponsible: false };
const rm = { roles: ['rm'] as const, isAssignee: false, isResponsible: true };
const admin = { roles: ['admin'] as const, isAssignee: false, isResponsible: false };

describe('task workflow', () => {
  it('walks one task from assigned to completed', () => {
    let stage = 'assigned' as const;
    const steps = [
      { action: 'start' as const, who: assignee, to: 'in_progress' },
      { action: 'submit' as const, who: assignee, to: 'submitted_rm_qc' },
      { action: 'approve' as const, who: rm, to: 'rm_approved' },
      { action: 'approve' as const, who: rm, to: 'submitted_admin_qc' },
      { action: 'approve' as const, who: admin, to: 'admin_approved' },
      { action: 'approve' as const, who: admin, to: 'ready_to_publish' },
      { action: 'complete' as const, who: admin, to: 'completed' },
    ];
    for (const step of steps) {
      const planned = planTaskTransition({
        action: step.action,
        stage,
        reason: null,
        ...step.who,
      });
      expect(planned).toMatchObject({ to: step.to });
      if ('to' in planned) {
        stage = planned.to;
      }
    }
    expect(stage).toBe('completed');
  });

  it('blocks a creator, an RM, and an admin from skipping a stage', () => {
    expect(
      planTaskTransition({ action: 'approve', stage: 'assigned', reason: null, ...assignee }).status,
    ).toBe(409);
    expect(
      planTaskTransition({ action: 'approve', stage: 'submitted_rm_qc', reason: null, ...admin })
        .status,
    ).toBe(403);
    expect(
      planTaskTransition({
        action: 'approve',
        stage: 'submitted_admin_qc',
        reason: null,
        ...rm,
      }).status,
    ).toBe(403);
    expect(
      planTaskTransition({ action: 'reject', stage: 'submitted_rm_qc', reason: '  ', ...rm }).status,
    ).toBe(400);
  });

  it('returns a task to the assignee and requires the stages again', () => {
    const rejected = planTaskTransition({
      action: 'reject',
      stage: 'rm_approved',
      reason: 'Crop the logo.',
      ...rm,
    });
    expect(rejected).toMatchObject({ to: 'changes_requested' });
    const again = planTaskTransition({
      action: 'resubmit',
      stage: 'changes_requested',
      reason: null,
      ...assignee,
    });
    expect(again).toMatchObject({ to: 'submitted_rm_qc' });
    expect(taskActions({ stage: 'submitted_rm_qc', ...rm })).toEqual(['approve', 'reject']);
  });
});
