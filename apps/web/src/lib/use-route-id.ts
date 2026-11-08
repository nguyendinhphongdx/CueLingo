import { usePathname } from 'next/navigation';
import { idsAfter } from './route-id';

/** The first id after `base` ("/sessions") in the current URL, or null (no id, or only the placeholder). */
export function useRouteId(base: string): string | null {
  return idsAfter(usePathname(), base)[0] ?? null;
}
