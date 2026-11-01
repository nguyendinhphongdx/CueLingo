import { Button } from '@cuelingo/ui/components/button';
import { Check, ExternalLink } from 'lucide-react';
import { openWeb } from './open-web';
import type { Feature } from './features';

export function SoonBadge() {
  return (
    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
      Sắp ra mắt
    </span>
  );
}

/** Placeholder for a feature that is on the roadmap but not built into the desktop app yet. */
export function ComingSoon({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <section aria-labelledby="soon-title" className="bg-card rounded-2xl border p-8">
      <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <h2 id="soon-title" className="text-lg font-semibold tracking-tight">
          {feature.label}
        </h2>
        <SoonBadge />
      </div>
      <p className="text-muted-foreground mt-1.5 max-w-[46ch] text-sm leading-relaxed">
        {feature.summary}
      </p>
      <ul className="mt-5 space-y-2.5">
        {feature.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5 text-sm">
            <Check aria-hidden="true" className="text-primary mt-0.5 size-4 shrink-0" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      {feature.webPath ? (
        <div className="mt-6 border-t pt-5">
          <p className="text-muted-foreground mb-3 text-sm">
            Trong lúc chờ bản trong app, bạn dùng được ngay trên web.
          </p>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => void openWeb(feature.webPath!)}
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            Mở trên web
          </Button>
        </div>
      ) : null}
    </section>
  );
}
