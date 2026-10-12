import { Injectable, NotFoundException } from '@nestjs/common';
import { mailboxError } from '../mail/mailbox.js';
import { noticeEmail, pendingDetail } from '../mail/notice-email.js';
import { redisUrl } from '../mail/mail-settings.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { NotificationDto } from './notification.types.js';

export function noticeSentence(value: string): string {
  const text = value.trim();
  if (text.length === 0 || /[.!?]$/.test(text)) {
    return text;
  }
  return `${text}.`;
}

const noticeInclude = {
  company: { select: { code: true } },
  emailDelivery: true,
};

type NoticeRow = Prisma.NotificationGetPayload<{ include: typeof noticeInclude }>;
type Writer = Pick<Prisma.TransactionClient, 'notification' | 'user' | 'emailDelivery'>;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async write(
    db: Writer,
    input: {
      companyId: string;
      recipientId: string;
      actorId: string;
      kind:
        | 'task_assigned'
        | 'task_updated'
        | 'time_returned'
        | 'asset_rejected'
        | 'asset_submitted'
        | 'asset_approved';
      body: string;
      href: string;
      mail?: { subject: string; text: string };
    },
  ): Promise<void> {
    if (input.recipientId === input.actorId) {
      return;
    }
    const duplicate = await db.notification.findFirst({
      where: {
        userId: input.recipientId,
        kind: input.kind,
        href: input.href,
        body: input.body,
      },
      select: { id: true },
    });
    if (duplicate) {
      return;
    }
    const created = await db.notification.create({
      data: {
        companyId: input.companyId,
        userId: input.recipientId,
        kind: input.kind,
        body: input.body,
        href: input.href,
      },
      include: { company: { select: { code: true } } },
    });
    const recipient = await db.user.findUniqueOrThrow({
      where: { id: input.recipientId },
      select: { email: true },
    });
    const fallback = noticeEmail({
      companyCode: created.company.code,
      kind: input.kind,
      body: created.body,
    });
    const copy = input.mail
      ? {
          subject: `[${created.company.code}] ${input.mail.subject}`,
          text: input.mail.text,
        }
      : fallback;
    const addressError = mailboxError(recipient.email);
    await db.emailDelivery.create({
      data: {
        notificationId: created.id,
        toAddress: addressError ? recipient.email.slice(0, 254) : recipient.email,
        subject: copy.subject,
        body: copy.text,
        status: addressError ? 'failed' : 'pending',
        detail: addressError ?? 'Waiting for the mail queue.',
      },
    });
  }

  async list(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: NotificationDto[]; total: number; unread: number }> {
    const [total, unread, rows] = await Promise.all([
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      this.prisma.notification.findMany({
        where: { userId },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: noticeInclude,
      }),
    ]);
    return { total, unread, items: rows.map((row) => this.toDto(row)) };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const existing = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: noticeInclude,
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('No notification has that id.');
    }
    if (existing.readAt) {
      return this.toDto(existing);
    }
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
      include: noticeInclude,
    });
    return this.toDto(updated);
  }

  private toDto(row: NoticeRow): NotificationDto {
    return {
      id: row.id,
      companyCode: row.company.code,
      kind: row.kind,
      body: row.body,
      href: row.href,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      email: row.emailDelivery
        ? {
            status: row.emailDelivery.status,
            toAddress: row.emailDelivery.toAddress,
            detail:
              row.emailDelivery.status === 'pending'
                ? pendingDetail(redisUrl() !== null)
                : row.emailDelivery.detail,
          }
        : null,
    };
  }
}
