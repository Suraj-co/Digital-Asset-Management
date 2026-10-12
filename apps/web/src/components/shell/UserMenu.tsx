import { Link } from 'react-router';
import { IncompleteNotice } from '@/components/shell/StatePanels';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/shell/session-context';

export function UserMenu() {
  const { session } = useSession();
  const label = session?.user.email ?? 'Not signed in';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="max-w-40 min-w-0 overflow-hidden">
          <span className="truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <IncompleteNotice>
          This menu does not collect a password. Sign in opens a server session.
          Company access is still not assigned.
        </IncompleteNotice>
        <Button asChild variant="outline" className="mt-3 w-full">
          <Link to="/sign-in">Sign in</Link>
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
