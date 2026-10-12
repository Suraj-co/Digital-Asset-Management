import { createContext, useContext } from 'react';
import type { Company } from '@/api/companies';

export type CompanyState = {
  companies: Company[];
  total: number;
  ready: boolean;
  error: string | null;
  selected: Company | null;
  select: (companyId: string) => void;
  reload: () => Promise<void>;
};

export const CompanyContext = createContext<CompanyState | null>(null);

export function useCompany(): CompanyState {
  const value = useContext(CompanyContext);
  if (!value) {
    throw new Error('useCompany must be used inside CompanyProvider');
  }
  return value;
}
