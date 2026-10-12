import { assignmentEmail, taskViewUrl } from './assignment-email.js';
import { mailboxError } from './mailbox.js';

describe('assignment email', () => {
  it('names Jai when the assigner is an RM', () => {
    const copy = assignmentEmail({
      role: 'rm',
      title: 'Crop the poster',
      description: 'Keep the harbor.',
      deadline: '2026-10-20',
      priority: 'high',
      taskUrl: taskViewUrl('http://127.0.0.1:43123'),
    });
    expect(copy.subject).toBe('Task assigned');
    expect(copy.text).toContain('Jai has assigned you a new task.');
    expect(copy.text).toContain('Title: Crop the poster');
    expect(copy.text).toContain('Description: Keep the harbor.');
    expect(copy.text).toContain('Deadline: 2026-10-20');
    expect(copy.text).toContain('Priority: High');
    expect(copy.text).toContain('View the task: http://127.0.0.1:43123/tasks');
  });

  it('names Aman when the assigner is an admin', () => {
    const copy = assignmentEmail({
      role: 'admin',
      title: 'Ship the banner',
      description: '',
      deadline: null,
      priority: null,
      taskUrl: 'http://127.0.0.1:43123/tasks',
    });
    expect(copy.text.startsWith('Aman has assigned you a new task.')).toBe(true);
    expect(copy.text).toContain('Description: None');
    expect(copy.text).toContain('Deadline: Not set');
    expect(copy.text).toContain('Priority: Not set');
  });
});

describe('mailbox', () => {
  it('rejects a blank, oversized, or header-breaking address', () => {
    expect(mailboxError('person@example.com')).toBeNull();
    expect(mailboxError('not-an-email')).toBe('Enter a valid email address.');
    expect(mailboxError('a@b.com\nBcc: other@example.com')).toBe('Enter a valid email address.');
    expect(mailboxError(`${'a'.repeat(250)}@example.com`)).toBe('Enter a valid email address.');
  });
});
