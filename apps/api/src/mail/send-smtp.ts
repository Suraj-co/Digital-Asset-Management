import nodemailer from 'nodemailer';
import type { SmtpSettings } from './mail-settings.js';

export async function sendSmtp(
  settings: SmtpSettings,
  message: { to: string; subject: string; text: string },
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth:
      settings.user && settings.password
        ? { user: settings.user, pass: settings.password }
        : undefined,
  });
  await transport.sendMail({
    from: settings.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
