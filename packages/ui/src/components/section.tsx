import { useId, type ReactNode } from 'react';

/** A titled group of content on an app screen. */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        {description ? <p className="text-muted-foreground mt-0.5 text-sm">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Bordered list container whose rows are separated by a line. */
export function ListCard({ children }: { children: ReactNode }) {
  return <ul className="bg-card divide-y overflow-hidden rounded-xl border">{children}</ul>;
}
