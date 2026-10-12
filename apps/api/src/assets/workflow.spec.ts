import { describe, expect, it } from 'vitest';
import { allowedActions, planTransition } from './workflow.js';

describe('workflow decisions', () => {
  it('lets a creator submit a draft and nobody else approve it', () => {
    expect(allowedActions('draft', 'not_started', ['creator'])).toEqual(['submit']);
    expect(planTransition({
      action: 'submit',
      stage: 'draft',
      publication: 'not_started',
      roles: ['creator'],
      reason: null,
    })).toMatchObject({ toStage: 'scope_analysis' });
    expect(planTransition({
      action: 'approve',
      stage: 'scope_analysis',
      publication: 'not_started',
      roles: ['creator'],
      reason: null,
    })).toMatchObject({ status: 403 });
  });

  it('advances RM stages and requires a rejection reason', () => {
    expect(planTransition({
      action: 'approve',
      stage: 'scope_analysis',
      publication: 'not_started',
      roles: ['rm'],
      reason: null,
    })).toMatchObject({ toStage: 'rm_qc' });
    expect(planTransition({
      action: 'approve',
      stage: 'admin_qc',
      publication: 'not_started',
      roles: ['rm'],
      reason: null,
    })).toMatchObject({ status: 403 });
    expect(planTransition({
      action: 'reject',
      stage: 'rm_qc',
      publication: 'not_started',
      roles: ['rm'],
      reason: null,
    })).toMatchObject({ status: 400, message: 'Enter a reason for the rejection.' });
    expect(planTransition({
      action: 'reject',
      stage: 'rm_qc',
      publication: 'not_started',
      roles: ['rm'],
      reason: 'Crop the logo.',
    })).toMatchObject({ toStage: 'changes_requested' });
  });

  it('marks the latest version ready to publish only after admin approval', () => {
    const approved = planTransition({
      action: 'approve',
      stage: 'admin_approval',
      publication: 'not_started',
      roles: ['admin'],
      reason: null,
    });
    expect(approved).toMatchObject({
      toStage: 'admin_approval',
      publication: 'ready',
      detail: 'Ready to publish.',
    });
    expect(planTransition({
      action: 'approve',
      stage: 'admin_approval',
      publication: 'ready',
      roles: ['admin'],
      reason: null,
    })).toMatchObject({ status: 409, message: 'This asset is ready to publish.' });
    expect(planTransition({
      action: 'approve',
      stage: 'admin_qc',
      publication: 'not_started',
      roles: ['admin'],
      reason: null,
    })).toMatchObject({ toStage: 'admin_approval', publication: 'not_started' });
    expect(allowedActions('admin_approval', 'ready', ['admin'])).toEqual(['reject']);
    expect(allowedActions('admin_approval', 'ready', ['creator'])).toEqual([]);
  });
});
