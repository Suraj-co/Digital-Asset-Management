export type SmtpSettings = {
  host: string;
  port: number;
  from: string;
  user: string | null;
  password: string | null;
};

function trimmed(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function redisUrl(source: NodeJS.ProcessEnv = process.env): string | null {
  const value = trimmed(source, 'REDIS_URL');
  if (value === '') {
    return null;
  }
  return value;
}

export function smtpConfigError(source: NodeJS.ProcessEnv = process.env): string | null {
  const host = trimmed(source, 'SMTP_HOST');
  const port = trimmed(source, 'SMTP_PORT');
  const from = trimmed(source, 'SMTP_FROM');
  const user = trimmed(source, 'SMTP_USER');
  const password = trimmed(source, 'SMTP_PASSWORD');
  const any = host !== '' || port !== '' || from !== '' || user !== '' || password !== '';
  if (!any) {
    return null;
  }
  const missing: string[] = [];
  if (host === '') missing.push('SMTP_HOST');
  if (port === '') missing.push('SMTP_PORT');
  if (from === '') missing.push('SMTP_FROM');
  if (user === '' && password !== '') missing.push('SMTP_USER');
  if (password === '' && user !== '') missing.push('SMTP_PASSWORD');
  if (missing.length > 0) {
    return `${missing.join(', ')}: required when any SMTP setting is set`;
  }
  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    return 'SMTP_PORT: expected a port from 1 to 65535';
  }
  return null;
}

export function readSmtp(source: NodeJS.ProcessEnv = process.env): SmtpSettings | null {
  if (smtpConfigError(source)) {
    return null;
  }
  const host = trimmed(source, 'SMTP_HOST');
  if (host === '') {
    return null;
  }
  const user = trimmed(source, 'SMTP_USER');
  const password = trimmed(source, 'SMTP_PASSWORD');
  return {
    host,
    port: Number(trimmed(source, 'SMTP_PORT')),
    from: trimmed(source, 'SMTP_FROM'),
    user: user === '' ? null : user,
    password: password === '' ? null : password,
  };
}

export function redisConfigError(source: NodeJS.ProcessEnv = process.env): string | null {
  const value = redisUrl(source);
  if (value === null) {
    return null;
  }
  if (!/^rediss?:\/\//.test(value)) {
    return 'REDIS_URL must start with redis:// or rediss://';
  }
  return null;
}
