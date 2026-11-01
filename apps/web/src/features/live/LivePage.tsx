import { ComingSoon } from '@cuelingo/ui/components/coming-soon';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { features } from '@cuelingo/ui/lib/roadmap';

const liveFeature = features.find((feature) => feature.id === 'home')!;

export function LivePage() {
  return (
    <>
      <PageHeader title="Phiên họp" />
      <ComingSoon
        feature={liveFeature}
        action={
          <p className="text-muted-foreground text-sm">
            Phiên họp trực tiếp chạy trong app macOS CueLingo.
          </p>
        }
      />
    </>
  );
}
