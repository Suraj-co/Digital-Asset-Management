import { Prisma } from '../generated/prisma/client.js';

export type PortalMembership = {
  companyId: string;
  role: 'creator' | 'rm' | 'admin';
};

const RM_REVIEW = ['scope_analysis', 'rm_qc', 'rm_approval'] as const;

function ids(memberships: PortalMembership[], role: PortalMembership['role'], excluded: string[]): string[] {
  return [
    ...new Set(
      memberships
        .filter((row) => row.role === role && !excluded.includes(row.companyId))
        .map((row) => row.companyId),
    ),
  ];
}

function buckets(memberships: PortalMembership[], companyId?: string) {
  const scoped = companyId
    ? memberships.filter((row) => row.companyId === companyId)
    : memberships;
  const admin = ids(scoped, 'admin', []);
  const rm = ids(scoped, 'rm', admin);
  const creator = ids(scoped, 'creator', [...admin, ...rm]);
  return { admin, rm, creator };
}

export function assetVisibility(
  userId: string,
  memberships: PortalMembership[],
  companyId?: string,
): Prisma.AssetWhereInput {
  const { admin, rm, creator } = buckets(memberships, companyId);
  const or: Prisma.AssetWhereInput[] = [];
  if (admin.length > 0) {
    or.push({ companyId: { in: admin } });
  }
  if (rm.length > 0) {
    or.push({
      companyId: { in: rm },
      OR: [
        { createdById: userId },
        { workflowStage: { in: [...RM_REVIEW] } },
        { decisions: { some: { actorId: userId } } },
        {
          taskLinks: {
            some: {
              task: {
                OR: [{ createdById: userId }, { assignments: { some: { userId } } }],
              },
            },
          },
        },
      ],
    });
  }
  if (creator.length > 0) {
    or.push({ companyId: { in: creator }, createdById: userId });
  }
  if (or.length === 0) {
    return { id: { in: [] } };
  }
  return { OR: or };
}

export function taskVisibility(
  userId: string,
  memberships: PortalMembership[],
  companyId?: string,
): Prisma.TaskWhereInput {
  const { admin, rm, creator } = buckets(memberships, companyId);
  const or: Prisma.TaskWhereInput[] = [];
  if (admin.length > 0) {
    or.push({ companyId: { in: admin } });
  }
  const limited = [...rm, ...creator];
  if (limited.length > 0) {
    or.push({
      companyId: { in: limited },
      OR: [{ createdById: userId }, { assignments: { some: { userId } } }],
    });
  }
  if (or.length === 0) {
    return { id: { in: [] } };
  }
  return { OR: or };
}
