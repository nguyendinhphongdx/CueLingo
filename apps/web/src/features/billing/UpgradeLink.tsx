'use client';

import { buttonVariants } from '@cuelingo/ui/components/button';
import Link from 'next/link';
import { useBillingOverview } from './use-billing';

/** "Nâng gói" link to /upgrade. Renders nothing while loading or when payments are off (`enabled: false`). */
export function UpgradeLink({ variant = 'outline' }: { variant?: 'default' | 'outline' }) {
  const { overview } = useBillingOverview();
  if (!overview?.enabled || overview.offers.length === 0) return null;
  return (
    <Link href="/upgrade" className={buttonVariants({ variant, size: 'sm' })}>
      Nâng gói
    </Link>
  );
}
