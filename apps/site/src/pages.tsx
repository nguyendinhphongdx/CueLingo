import type { DownloadLinks } from '@cuelingo/ui/components/landing/detect-os';
import type { LandingPaths } from '@cuelingo/ui/components/landing/landing-link';
import { DownloadPage } from '@cuelingo/ui/components/landing/download-page';
import { LandingView } from '@cuelingo/ui/components/landing/landing-view';
import type { ReactNode } from 'react';

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">{children}</div>
  );
}

export function SiteHome({ paths, downloads }: { paths: LandingPaths; downloads?: DownloadLinks }) {
  return (
    <Shell>
      <LandingView paths={paths} downloads={downloads} />
    </Shell>
  );
}

export function SiteDownload({
  paths,
  downloads,
}: {
  paths: LandingPaths;
  downloads: DownloadLinks;
}) {
  return (
    <Shell>
      <DownloadPage downloads={downloads} paths={paths} />
    </Shell>
  );
}
