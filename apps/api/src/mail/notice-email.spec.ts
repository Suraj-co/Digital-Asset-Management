import {
  failedDetail,
  heldBecauseNoSmtp,
  noticeEmail,
  pendingDetail,
} from './notice-email.js';

describe('notice email copy', () => {
  it('names the company and keeps the in-app sentence', () => {
    const copy = noticeEmail({
      companyCode: 'SAPL',
      kind: 'task_assigned',
      body: 'An admin assigned the poster.',
    });
    expect(copy.subject).toBe('[SAPL] Task assigned');
    expect(copy.text).toContain('An admin assigned the poster.');
  });

  it('says the copy is held when no mail server is configured', () => {
    expect(heldBecauseNoSmtp().detail).toContain('was not sent');
  });

  it('says Redis is missing while the row is still pending', () => {
    expect(pendingDetail(false)).toContain('Redis is not configured');
    expect(pendingDetail(true)).toContain('Waiting for the mail queue');
  });

  it('shortens a mail server error', () => {
    expect(failedDetail('x'.repeat(400)).length).toBeLessThan(220);
  });
});
