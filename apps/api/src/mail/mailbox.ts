const MAILBOX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function mailboxError(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || /[\u0000-\u001f\s]/.test(email)) {
    return 'Enter a valid email address.';
  }
  if (!MAILBOX.test(email)) {
    return 'Enter a valid email address.';
  }
  return null;
}
