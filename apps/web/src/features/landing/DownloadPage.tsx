import { DownloadPage as DownloadView } from '@cuelingo/ui/components/landing/download-page';
import Link from 'next/link';

const PATHS = { home: '/', download: '/download', login: '/login' };

export function DownloadPage({ downloadUrl }: { downloadUrl: string | null }) {
  return <DownloadView downloadUrl={downloadUrl} link={Link} paths={PATHS} />;
}
