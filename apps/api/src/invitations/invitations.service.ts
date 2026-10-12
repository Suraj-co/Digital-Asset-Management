import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { hashPassword } from '../auth/password.js';
import { hashSessionToken, newSessionToken } from '../auth/session-token.js';
import { loadEnv } from '../config/env.js';
import { Prisma, type EmailStatus } from '../generated/prisma/client.js';
import { mailboxError } from '../mail/mailbox.js';
import type { AssignerRole } from '../mail/assignment-email.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  INVITATION_TTL_MS,
  invitationEmail,
  invitationNameError,
  invitationSetupUrl,
  passwordSetupError,
} from './invitation-email.js';
import type {
  AcceptedInvitationDto,
  CreatorInvitationDto,
  InvitationDeliveryDto,
} from './invitation.types.js';

type DeliveryRow = { status: EmailStatus; detail: string } | null;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async list(actorId: string, companyId: string): Promise<{ items: CreatorInvitationDto[] }> {
    const company = await this.requireCompany(companyId);
    await this.inviterRole(actorId, companyId);
    const rows = await this.prisma.creatorInvitation.findMany({
      where: { companyId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        company: { select: { code: true } },
        emailDelivery: { select: { status: true, detail: true } },
      },
    });
    return {
      items: rows.map((row) => this.toDto(row, company.code, row.emailDelivery)),
    };
  }

  async invite(
    actorId: string,
    companyId: string,
    input: { name: string; email: string; password: string },
  ): Promise<CreatorInvitationDto> {
    const company = await this.requireCompany(companyId);
    const role = await this.inviterRole(actorId, companyId);
    const email = input.email.trim().toLowerCase();
    if (mailboxError(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }
    const name = input.name.trim();
    if (invitationNameError(name)) {
      throw new BadRequestException('Enter a name of 1 to 80 characters.');
    }
    const passwordError = passwordSetupError(input.password, email);
    if (passwordError) {
      throw new BadRequestException(passwordError);
    }
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('An account already uses that email.');
    }
    const pending = await this.prisma.creatorInvitation.findFirst({
      where: {
        companyId,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException('An invitation is already waiting for that email.');
    }
    const passwordHash = await hashPassword(input.password);
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const copy = invitationEmail({
      role,
      inviteeName: name,
      loginEmail: email,
      setupUrl: invitationSetupUrl(loadEnv().webOrigin, token),
      expiresAt,
      passwordAlreadySet: true,
    });
    const actorEmail = await this.audit.emailOf(actorId);
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, status: 'active' },
        select: { id: true },
      });
      await tx.membership.create({
        data: { userId: user.id, companyId, role: 'creator' },
      });
      const invitation = await tx.creatorInvitation.create({
        data: {
          companyId,
          email,
          name,
          invitedById: actorId,
          tokenHash: hashSessionToken(token),
          expiresAt,
        },
      });
      const delivery = await tx.emailDelivery.create({
        data: {
          invitationId: invitation.id,
          toAddress: email,
          subject: `[${company.code}] ${copy.subject}`,
          body: copy.text,
          status: 'pending',
          detail: 'Waiting for delivery.',
        },
      });
      await this.audit.write(tx, {
        companyId,
        actorId,
        action: 'creator_invited',
        summary: `${actorEmail} invited ${email} as a creator.`,
        subjectType: 'creator_invitation',
        subjectId: invitation.id,
      });
      return { invitation, deliveryId: delivery.id };
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account already uses that email.');
      }
      throw error;
    });
    const delivery = await this.mail.deliverNow(created.deliveryId);
    return this.toDto(created.invitation, company.code, delivery);
  }

  async resend(
    actorId: string,
    companyId: string,
    invitationId: string,
  ): Promise<CreatorInvitationDto> {
    const company = await this.requireCompany(companyId);
    const role = await this.inviterRole(actorId, companyId);
    const invitation = await this.prisma.creatorInvitation.findFirst({
      where: { id: invitationId, companyId },
      include: { emailDelivery: { select: { id: true } } },
    });
    if (!invitation) {
      throw new NotFoundException('No invitation has that id.');
    }
    if (invitation.acceptedAt) {
      throw new BadRequestException('This invitation has already been used.');
    }
    const account = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const copy = invitationEmail({
      role,
      inviteeName: invitation.name,
      loginEmail: invitation.email,
      setupUrl: invitationSetupUrl(loadEnv().webOrigin, token),
      expiresAt,
      passwordAlreadySet: Boolean(account),
    });
    const actorEmail = await this.audit.emailOf(actorId);
    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.creatorInvitation.update({
        where: { id: invitation.id },
        data: { tokenHash: hashSessionToken(token), expiresAt },
      });
      const delivery = invitation.emailDelivery
        ? await tx.emailDelivery.update({
            where: { id: invitation.emailDelivery.id },
            data: {
              toAddress: invitation.email,
              subject: `[${company.code}] ${copy.subject}`,
              body: copy.text,
              status: 'pending',
              detail: 'Waiting for delivery.',
              sentAt: null,
            },
          })
        : await tx.emailDelivery.create({
            data: {
              invitationId: invitation.id,
              toAddress: invitation.email,
              subject: `[${company.code}] ${copy.subject}`,
              body: copy.text,
              status: 'pending',
              detail: 'Waiting for delivery.',
            },
          });
      await this.audit.write(tx, {
        companyId,
        actorId,
        action: 'creator_invited',
        summary: `${actorEmail} resent the creator invitation to ${invitation.email}.`,
        subjectType: 'creator_invitation',
        subjectId: invitation.id,
      });
      return { invitation: updated, deliveryId: delivery.id };
    });
    const delivery = await this.mail.deliverNow(saved.deliveryId);
    return this.toDto(saved.invitation, company.code, delivery);
  }

  async accept(token: string, password: string): Promise<AcceptedInvitationDto> {
    if (token.length < 20 || token.length > 128 || /[^A-Za-z0-9_-]/.test(token)) {
      throw new BadRequestException('This invitation is not valid.');
    }
    const invitation = await this.prisma.creatorInvitation.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { company: { select: { id: true, code: true } } },
    });
    if (!invitation) {
      throw new BadRequestException('This invitation is not valid.');
    }
    if (invitation.acceptedAt) {
      throw new BadRequestException('This invitation has already been used.');
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This invitation has expired.');
    }
    const passwordError = passwordSetupError(password, invitation.email);
    if (passwordError) {
      throw new BadRequestException(passwordError);
    }
    const passwordHash = await hashPassword(password);
    const actorEmail = await this.audit.emailOf(invitation.invitedById);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.creatorInvitation.updateMany({
          where: {
            id: invitation.id,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { acceptedAt: new Date() },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException('This invitation has already been used.');
        }
        const result = await this.openAccount(tx, invitation, passwordHash);
        if (result.membershipId) {
          await this.audit.write(tx, {
            companyId: invitation.companyId,
            actorId: invitation.invitedById,
            action: 'membership_granted',
            summary: `${actorEmail} granted creator to ${invitation.email}.`,
            subjectType: 'membership',
            subjectId: result.membershipId,
          });
        }
        return {
          email: invitation.email,
          companyCode: invitation.company.code,
          passwordSet: result.passwordSet,
        };
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account already uses that email.');
      }
      throw error;
    }
  }

  private async openAccount(
    tx: Prisma.TransactionClient,
    invitation: { id: string; email: string; companyId: string },
    passwordHash: string,
  ): Promise<{ passwordSet: boolean; membershipId: string | null }> {
    const existing = await tx.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, status: true },
    });
    if (existing?.status === 'disabled') {
      throw new ConflictException('This account is disabled.');
    }
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { passwordHash },
          select: { id: true },
        })
      : await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            status: 'active',
          },
          select: { id: true },
        });
    const membership = await tx.membership.findFirst({
      where: { userId: user.id, companyId: invitation.companyId, role: 'creator' },
      select: { id: true },
    });
    if (membership) {
      return { passwordSet: true, membershipId: null };
    }
    const created = await tx.membership.create({
      data: { userId: user.id, companyId: invitation.companyId, role: 'creator' },
      select: { id: true },
    });
    return { passwordSet: true, membershipId: created.id };
  }

  private async requireCompany(companyId: string): Promise<{ id: string; code: string }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, code: true },
    });
    if (!company) {
      throw new NotFoundException('No company has that id.');
    }
    return company;
  }

  private toDto(
    invitation: { id: string; email: string; name: string; expiresAt: Date },
    companyCode: string,
    delivery: DeliveryRow,
  ): CreatorInvitationDto {
    return {
      id: invitation.id,
      email: invitation.email,
      name: invitation.name,
      companyCode,
      expiresAt: invitation.expiresAt.toISOString(),
      delivery: this.deliveryOf(delivery),
    };
  }

  private deliveryOf(delivery: DeliveryRow): InvitationDeliveryDto {
    if (!delivery) {
      return { status: 'pending', detail: 'No email copy was saved.' };
    }
    return { status: delivery.status, detail: delivery.detail };
  }

  private async inviterRole(userId: string, companyId: string): Promise<AssignerRole> {
    const rows = await this.prisma.membership.findMany({
      where: { userId, companyId },
      select: { role: true },
    });
    if (rows.some((row) => row.role === 'admin')) {
      return 'admin';
    }
    if (rows.some((row) => row.role === 'rm')) {
      return 'rm';
    }
    throw new ForbiddenException('Only an RM or an admin can invite a creator.');
  }
}
