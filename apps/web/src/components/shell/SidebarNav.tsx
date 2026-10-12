import { NavLink } from 'react-router';
import { NAV_ITEMS } from '@/shell/navigation';
import { cn } from '@/lib/utils';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
