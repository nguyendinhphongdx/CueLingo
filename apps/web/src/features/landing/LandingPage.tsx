'use client';

import { LandingSessionCheck, LandingView } from '@cuelingo/ui/components/landing/landing-view';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authClient } from '../../lib/auth-client';
import { redirectSignedInVisitor } from './session-redirect';

const PATHS = { home: '/', download: '/download', login: '/login' };

export function LandingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    redirectSignedInVisitor(session, isPending, router);
  }, [isPending, router, session]);

  if (isPending || session) return <LandingSessionCheck />;

  return <LandingView link={Link} paths={PATHS} />;
}
