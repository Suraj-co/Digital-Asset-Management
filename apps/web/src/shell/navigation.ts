export const COMPANY_CODES = [
  'BAPL',
  'SAPL',
  'GBAPL',
  'KABPL',
  'Ontale',
] as const;

export const NAV_ITEMS = [
  { to: '/', label: 'Environment', end: true },
  { to: '/companies', label: 'Companies', end: false },
  { to: '/folders', label: 'Folders', end: false },
  { to: '/assets', label: 'Assets', end: false },
  { to: '/tasks', label: 'Tasks', end: false },
  { to: '/time', label: 'Time', end: false },
  { to: '/dashboard', label: 'Dashboard', end: false },
  { to: '/notifications', label: 'Notifications', end: false },
  { to: '/audit', label: 'Audit', end: false },
  { to: '/design-system', label: 'Design system', end: false },
] as const;
