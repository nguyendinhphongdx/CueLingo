'use client';

// A client module: `Link` is a function, and a server component cannot hand a function to the client-side page.
import { DownloadPage as DownloadView } from '@cuelingo/ui/components/landing/download-page';
import type { DownloadLinks } from '@cuelingo/ui/components/landing/detect-os';
import Link from 'next/link';

const PATHS = { home: '/', download: '/download', login: '/login' };

export function DownloadPage({ downloads }: { downloads: DownloadLinks }) {
  return <DownloadView downloads={downloads} link={Link} paths={PATHS} />;
}
