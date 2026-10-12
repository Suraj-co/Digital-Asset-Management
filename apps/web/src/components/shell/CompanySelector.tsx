import { roleLabel } from '@/api/companies';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCompany } from '@/shell/company-context';
import { useSession } from '@/shell/session-context';

export function CompanySelector() {
  const { session, ready } = useSession();
  const company = useCompany();
  const label = company.selected?.code ?? 'No company';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" aria-label="Company">
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-3">
        <CompanyMenu ready={ready} signedIn={session !== null} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CompanyMenu({
  ready,
  signedIn,
}: {
  ready: boolean;
  signedIn: boolean;
}) {
  const company = useCompany();
  if (!ready || (signedIn && !company.ready)) {
    return <p className="text-sm text-muted-foreground">Loading company membership.</p>;
  }
  if (company.error) {
    return <p className="text-sm text-bad">{company.error}</p>;
  }
  if (!signedIn) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Sign in to see company membership. This control does not grant access.
      </p>
    );
  }
  if (company.companies.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        No membership is assigned. This control does not grant access.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {company.companies.map((item) => (
        <DropdownMenuItem
          key={item.id}
          disabled={!item.active}
          onSelect={() => company.select(item.id)}
          aria-current={company.selected?.id === item.id ? 'true' : undefined}
        >
          <span>{item.code}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {item.active ? item.roles.map(roleLabel).join(', ') : 'Inactive'}
          </span>
        </DropdownMenuItem>
      ))}
      {company.total > company.companies.length ? (
        <p className="text-sm text-muted-foreground">
          Open Companies to see every membership.
        </p>
      ) : null}
      <p className="text-sm leading-6 text-muted-foreground">
        Selecting a company does not grant access. The server checks membership
        on each request.
      </p>
    </div>
  );
}
