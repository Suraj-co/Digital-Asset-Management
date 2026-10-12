export type NoticeKind =
  | 'task_assigned'
  | 'task_updated'
  | 'time_returned'
  | 'asset_rejected'
  | 'asset_submitted'
  | 'asset_approved';

const SUBJECT: Record<NoticeKind, string> = {
  task_assigned: 'Task assigned',
  task_updated: 'Task updated',
  time_returned: 'Time returned',
  asset_rejected: 'Asset rejected',
  asset_submitted: 'Asset submitted',
  asset_approved: 'Asset approved',
};

export function noticeEmail(input: {
  companyCode: string;
  kind: NoticeKind;
  body: string;
}): { subject: string; text: string } {
  return {
    subject: `[${input.companyCode}] ${SUBJECT[input.kind]}`,
    text: `${input.body}\n\nThis copy is also saved in Aaradhya DAM.`,
  };
}

export function heldBecauseNoSmtp(): { status: 'held'; detail: string } {
  return {
    status: 'held',
    detail: 'No mail server is configured. This copy is kept here and was not sent.',
  };
}

export function sentDetail(toAddress: string): string {
  return `Sent to ${toAddress}.`;
}

export function failedDetail(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim().slice(0, 180);
  return `The mail server refused the message. ${clean}`;
}

export function pendingDetail(redisConfigured: boolean): string {
  if (!redisConfigured) {
    return 'Redis is not configured. This message stays in the app and was not sent.';
  }
  return 'Waiting for the mail queue.';
}
