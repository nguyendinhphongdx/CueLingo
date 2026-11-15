import Link from 'next/link';

/** The four admin screens, in the order they are listed. */
export const ADMIN_LINKS = [
  { href: '/admin/users', label: 'Người dùng' },
  { href: '/admin/metrics', label: 'Số liệu' },
  { href: '/admin/invites', label: 'Mã mời' },
  { href: '/admin/agent', label: 'Trợ lý AI' },
] as const;

const trimmed = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/** True for the page itself and for the pages under it (`/admin/users/<id>` belongs to `/admin/users`). */
export function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const current = trimmed(pathname);
  return current === href || current.startsWith(`${href}/`);
}

/** Links between the admin screens. Rendered only once the API has shown the caller is an admin. */
export function AdminNav({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Quản trị" className="mb-6 flex flex-wrap gap-1 border-b pb-3">
      {ADMIN_LINKS.map((link) => {
        const active = isCurrent(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`focus-visible:ring-ring min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
