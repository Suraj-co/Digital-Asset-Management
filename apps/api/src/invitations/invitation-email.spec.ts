import { invitationEmail, invitationSetupUrl, passwordSetupError } from './invitation-email.js';

describe('creator invitation email', () => {
  const expiresAt = new Date('2026-10-19T06:00:00.000Z');

  it('names the RM and does not include a password', () => {
    const copy = invitationEmail({
      role: 'rm',
      inviteeName: 'Meera',
      loginEmail: 'meera@example.com',
      setupUrl: invitationSetupUrl('http://127.0.0.1:43123', 'token-value'),
      expiresAt,
      passwordAlreadySet: true,
    });
    expect(copy.subject).toBe('Creator invitation');
    expect(copy.text).toContain('Jai, an RM, invited you to Aaradhya DAM as a Creator.');
    expect(copy.text).toContain('Login email: meera@example.com');
    expect(copy.text).toContain(
      'Change your password: http://127.0.0.1:43123/invite/token-value',
    );
    expect(copy.text).toContain('This message does not include a password.');
    expect(copy.text).not.toContain('secret-password');
  });

  it('keeps the setup link when the inviter has not set a password', () => {
    const copy = invitationEmail({
      role: 'rm',
      inviteeName: 'Meera',
      loginEmail: 'meera@example.com',
      setupUrl: invitationSetupUrl('http://127.0.0.1:43123', 'token-value'),
      expiresAt,
      passwordAlreadySet: false,
    });
    expect(copy.text).toContain('Set your password: http://127.0.0.1:43123/invite/token-value');
    expect(copy.text).toContain('This message does not include a password.');
  });

  it('names the admin', () => {
    const copy = invitationEmail({
      role: 'admin',
      inviteeName: 'Meera',
      loginEmail: 'meera@example.com',
      setupUrl: 'http://127.0.0.1:43123/invite/token-value',
      expiresAt,
      passwordAlreadySet: true,
    });
    expect(copy.text).toContain('Aman, an Admin, invited you to Aaradhya DAM as a Creator.');
  });

  it('rejects a short password and a password that repeats the email', () => {
    expect(passwordSetupError('short', 'meera@example.com')).toBe('Use 12 to 200 characters.');
    expect(passwordSetupError('meera@example.com', 'meera@example.com')).toBe(
      'Use a password that is not the email.',
    );
    expect(passwordSetupError('correct-horse-battery', 'meera@example.com')).toBeNull();
  });
});
