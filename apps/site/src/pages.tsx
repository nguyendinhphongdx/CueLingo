import type { LandingPaths } from '@cuelingo/ui/components/landing/landing-link';
import { DownloadPage } from '@cuelingo/ui/components/landing/download-page';
import { LandingView } from '@cuelingo/ui/components/landing/landing-view';
import type { ReactNode } from 'react';

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">{children}</div>
  );
}

export function SiteHome({ paths }: { paths: LandingPaths }) {
  return (
    <Shell>
      <LandingView paths={paths} />
    </Shell>
  );
}

export function SiteDownload({
  paths,
  downloadUrl,
}: {
  paths: LandingPaths;
  downloadUrl: string | null;
}) {
  return (
    <Shell>
      <DownloadPage downloadUrl={downloadUrl} paths={paths} />
    </Shell>
  );
}
