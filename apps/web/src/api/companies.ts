import { z } from 'zod';

const roleSchema = z.enum(['creator', 'rm', 'admin']);

export const companySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
  roles: z.array(roleSchema),
});

export const companyPageSchema = z.object({
  items: z.array(companySchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

const membershipSchema = z.object({
  id: z.string(),
  userId: z.string(),
  email: z.string(),
  companyId: z.string(),
  companyCode: z.string(),
  role: roleSchema,
});

const userMembershipSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companyCode: z.string(),
  role: roleSchema,
});

const managedUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: z.enum(['active', 'disabled']),
  memberships: z.array(userMembershipSchema),
});

const userPageSchema = z.object({
  items: z.array(managedUserSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type Company = z.infer<typeof companySchema>;
export type CompanyPage = z.infer<typeof companyPageSchema>;
export type MembershipRole = z.infer<typeof roleSchema>;
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type UserPage = z.infer<typeof userPageSchema>;

export class CompanyRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyRequestError';
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // The body was not JSON.
  }
  return 'The company request failed.';
}

async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) {
    throw new CompanyRequestError(await readError(response));
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new CompanyRequestError('The company response did not match the contract.');
  }
  return parsed.data;
}

export function fetchCompanyPage(): Promise<CompanyPage> {
  return fetch('/api/v1/companies?limit=100&offset=0', {
    credentials: 'include',
  }).then((response) => parse(response, companyPageSchema));
}

export function grantMembership(
  companyId: string,
  email: string,
  role: MembershipRole,
): Promise<z.infer<typeof membershipSchema>> {
  return fetch(`/api/v1/companies/${companyId}/memberships`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  }).then((response) => parse(response, membershipSchema));
}

export function revokeMembership(
  companyId: string,
  membershipId: string,
): Promise<void> {
  return fetch(`/api/v1/companies/${companyId}/memberships/${membershipId}`, {
    method: 'DELETE',
    credentials: 'include',
  }).then(async (response) => {
    if (!response.ok && response.status !== 204) {
      throw new CompanyRequestError(await readError(response));
    }
  });
}

export function fetchUsers(offset: number): Promise<UserPage> {
  return fetch(`/api/v1/users?limit=20&offset=${offset}`, {
    credentials: 'include',
  }).then((response) => parse(response, userPageSchema));
}

export function updateUserStatus(
  userId: string,
  status: 'active' | 'disabled',
): Promise<ManagedUser> {
  return fetch(`/api/v1/users/${userId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }).then((response) => parse(response, managedUserSchema));
}

export function setPayRate(
  companyId: string,
  hourlyRateMinor: number,
  currency: 'INR' | 'USD' | 'EUR',
): Promise<void> {
  return fetch(`/api/v1/companies/${companyId}/pay-rate`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hourlyRateMinor, currency }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new CompanyRequestError(await readError(response));
    }
  });
}

const deliverySchema = z.object({
  status: z.enum(['pending', 'queued', 'held', 'sent', 'failed']),
  detail: z.string(),
});

const invitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  companyCode: z.string(),
  expiresAt: z.string(),
  delivery: deliverySchema,
});

const invitationListSchema = z.object({
  items: z.array(invitationSchema),
});

export type CreatorInvitation = z.infer<typeof invitationSchema>;

const acceptedInvitationSchema = z.object({
  email: z.string(),
  companyCode: z.string(),
  passwordSet: z.boolean(),
});

export type AcceptedInvitation = z.infer<typeof acceptedInvitationSchema>;

export function fetchCreatorInvitations(companyId: string) {
  return fetch(`/api/v1/companies/${companyId}/creator-invitations`, {
    credentials: 'include',
  }).then((response) => parse(response, invitationListSchema));
}

export function inviteCreator(companyId: string, name: string, email: string, password: string) {
  return fetch(`/api/v1/companies/${companyId}/creator-invitations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  }).then((response) => parse(response, invitationSchema));
}

export function resendCreatorInvitation(companyId: string, invitationId: string) {
  return fetch(`/api/v1/companies/${companyId}/creator-invitations/${invitationId}/resend`, {
    method: 'POST',
    credentials: 'include',
  }).then((response) => parse(response, invitationSchema));
}

export function invitationNotice(
  email: string,
  delivery: { status: string; detail: string },
): { tone: 'ok' | 'bad'; text: string } {
  if (delivery.status === 'sent') {
    return {
      tone: 'ok',
      text: `Invitation sent to ${email}. The email does not include the password. ${delivery.detail}`,
    };
  }
  if (delivery.status === 'queued' || delivery.status === 'pending') {
    return { tone: 'ok', text: `Invitation queued for ${email}. ${delivery.detail}` };
  }
  return { tone: 'bad', text: `Invitation was not sent to ${email}. ${delivery.detail}` };
}

export function acceptInvitation(token: string, password: string): Promise<AcceptedInvitation> {
  return fetch('/api/v1/invitations/accept', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  }).then((response) => parse(response, acceptedInvitationSchema));
}

export function roleLabel(role: MembershipRole): string {
  if (role === 'rm') {
    return 'RM';
  }
  if (role === 'admin') {
    return 'Admin';
  }
  return 'Creator';
}
