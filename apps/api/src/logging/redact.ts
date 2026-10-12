const CONNECTION_URL = /postgres(?:ql)?:\/\/[^@\s]+@/gi;

export function redact(value: string): string {
  return value.replace(CONNECTION_URL, 'postgresql://***@');
}
