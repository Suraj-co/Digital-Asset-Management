import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { CompanyProvider } from '@/shell/company';
import { SessionProvider } from '@/shell/session';
import { Menu } from 'lucide-react';
import { CompanySelector } from '@/components/shell/CompanySelector';
import { NotificationsMenu } from '@/components/shell/NotificationsMenu';
import { SidebarNav } from '@/components/shell/SidebarNav';
import { UserMenu } from '@/components/shell/UserMenu';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

function ShellSearch() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  const [seen, setSeen] = useState(query);
  if (query !== seen) {
    setSeen(query);
    setDraft(query);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = draft.trim();
    navigate(q.length > 0 ? `/assets?q=${encodeURIComponent(q)}` : '/assets');
  }

  return (
    <form className="flex min-w-0 basis-full gap-2 sm:basis-auto sm:flex-1" onSubmit={onSubmit}>
      <label htmlFor="shell-search" className="sr-only">
        Search
      </label>
      <Input
        id="shell-search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search code, title, or file name"
        aria-describedby="shell-search-note"
        className="w-0 min-w-0 flex-1"
      />
      <Button type="submit" variant="outline">
        Search
      </Button>
      <p id="shell-search-note" className="sr-only">
        Searches asset codes, titles, and file names in the selected company. File contents are
        not searched.
      </p>
    </form>
  );
}

function currentCrumb(pathname: string): string {
  if (pathname === '/') {
    return 'Environment';
  }
  if (pathname === '/companies') {
    return 'Companies';
  }
  if (pathname === '/folders') {
    return 'Folders';
  }
  if (pathname === '/assets') {
    return 'Assets';
  }
  if (pathname.startsWith('/assets/')) {
    return 'Asset';
  }
  if (pathname === '/tasks') {
    return 'Tasks';
  }
  if (pathname === '/time') {
    return 'Time';
  }
  if (pathname === '/dashboard') {
    return 'Dashboard';
  }
  if (pathname === '/notifications') {
    return 'Notifications';
  }
  if (pathname === '/audit') {
    return 'Audit';
  }
  if (pathname === '/design-system') {
    return 'Design system';
  }
  if (pathname === '/sign-in') {
    return 'Sign in';
  }
  return 'Page not available';
}

export function AppShell() {
  const { pathname } = useLocation();
  const crumb = currentCrumb(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: import.meta.env.MODE === 'test' ? false : 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
    <SessionProvider>
    <CompanyProvider>
    <div className="flex min-h-svh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      >
        Skip to content
      </a>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground md:flex">
        <NavLink to="/" className="rounded-md px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring">
          <span className="block text-sm font-semibold tracking-tight">Aaradhya DAM</span>
          <span className="mt-1 block text-xs text-sidebar-foreground/70">
            Enterprise asset platform
          </span>
        </NavLink>
        <div className="mt-6">
          <SidebarNav />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:flex-nowrap sm:gap-3 sm:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
                <SheetHeader>
                  <SheetTitle className="text-sidebar-foreground">Aaradhya DAM</SheetTitle>
                </SheetHeader>
                <div className="px-4">
                  <SidebarNav onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <ShellSearch />
            <div className="flex min-w-0 max-w-full items-center gap-2">
              <CompanySelector />
              <NotificationsMenu />
              <UserMenu />
            </div>
          </div>
        </header>
        <div className="border-b border-border bg-card px-4 py-2 sm:px-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <NavLink to="/">Aaradhya DAM</NavLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{crumb}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <main id="main" className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-8 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
    </CompanyProvider>
    </SessionProvider>
    </QueryClientProvider>
  );
}
