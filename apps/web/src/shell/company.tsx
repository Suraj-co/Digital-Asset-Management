import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { CompanyRequestError, fetchCompanyPage } from '@/api/companies';
import type { Company } from '@/api/companies';
import { CompanyContext } from '@/shell/company-context';
import { useSession } from '@/shell/session-context';

const noCompanies: Company[] = [];

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { session, ready: sessionReady } = useSession();
  const userId = session?.user.id ?? null;
  const [picked, setPicked] = useState<{ userId: string; companyId: string } | null>(
    null,
  );
  const query = useQuery({
    queryKey: ['companies', userId],
    enabled: userId !== null,
    queryFn: fetchCompanyPage,
  });
  const { refetch } = query;
  const pickedId = picked?.userId === userId ? picked.companyId : null;

  const companies = query.data?.items ?? noCompanies;
  const selected =
    companies.find((company) => company.id === pickedId && company.active) ??
    companies.find((company) => company.active) ??
    null;

  const select = useCallback(
    (companyId: string) => {
      if (
        userId &&
        companies.some((company) => company.id === companyId && company.active)
      ) {
        setPicked({ userId, companyId });
      }
    },
    [companies, userId],
  );

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const error =
    query.error instanceof CompanyRequestError
      ? query.error.message
      : query.error
        ? 'The company request failed.'
        : null;

  const value = useMemo(
    () => ({
      companies,
      total: query.data?.total ?? 0,
      ready: sessionReady && (userId === null || query.isFetched),
      error,
      selected,
      select,
      reload,
    }),
    [
      companies,
      query.data?.total,
      query.isFetched,
      sessionReady,
      userId,
      error,
      selected,
      select,
      reload,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}
