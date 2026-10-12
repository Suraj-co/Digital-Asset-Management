import { assignerName, type AssignerRole } from '../mail/assignment-email.js';

const ROLE_LABEL: Record<AssignerRole, string> = {
  rm: 'RM',
  admin: 'Admin',
};

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function invitationSetupUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/invite/${encodeURIComponent(token)}`;
}

export function invitationEmail(input: {
  role: AssignerRole;
  inviteeName: string;
  loginEmail: string;
  setupUrl: string;
  expiresAt: Date;
  passwordAlreadySet: boolean;
}): { subject: string; text: string } {
  const roleLabel = ROLE_LABEL[input.role];
  const passwordLine = input.passwordAlreadySet
    ? 'Your inviter set your initial password. This message does not include a password.'
    : 'This message does not include a password. Set one from the link before you sign in.';
  const linkLine = input.passwordAlreadySet
    ? `Change your password: ${input.setupUrl}`
    : `Set your password: ${input.setupUrl}`;
  return {
    subject: 'Creator invitation',
    text: [
      `${assignerName(input.role)}, an ${roleLabel}, invited you to Aaradhya DAM as a Creator.`,
      '',
      `Name: ${input.inviteeName}`,
      `Login email: ${input.loginEmail}`,
      '',
      passwordLine,
      linkLine,
      '',
      `This invitation expires at ${input.expiresAt.toISOString()}.`,
    ].join('\n'),
  };
}

export function passwordSetupError(password: string, email: string): string | null {
  if (password.length < 12 || password.length > 200) {
    return 'Use 12 to 200 characters.';
  }
  if (/[\u0000-\u001f]/.test(password)) {
    return 'Use a password without control characters.';
  }
  if (password.toLowerCase() === email.toLowerCase()) {
    return 'Use a password that is not the email.';
  }
  return null;
}

export function invitationNameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 80 || /[\u0000-\u001f]/.test(trimmed)) {
    return 'Enter a name of 1 to 80 characters.';
  }
  return null;
}
