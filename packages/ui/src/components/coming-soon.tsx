import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Feature } from '../lib/roadmap';
import { FeatureIcon } from './feature-icon';
import { SoonBadge } from './soon-badge';

/** Placeholder for a feature that is on the roadmap but not built into this client yet. */
export function ComingSoon({ feature, action }: { feature: Feature; action?: ReactNode }) {
  return (
    <section aria-labelledby="soon-title" className="bg-card rounded-2xl border p-8">
      <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
        <FeatureIcon name={feature.icon} className="size-5" />
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
      {action ? <div className="mt-6 border-t pt-5">{action}</div> : null}
    </section>
  );
}
