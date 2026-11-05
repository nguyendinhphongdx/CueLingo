import { cn } from '../lib/utils';

/** "The assistant is working" with three dots; the dots stay still when the person asked for less motion. */
export function ThinkingIndicator({
  label = 'Đang suy nghĩ…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn('text-muted-foreground flex items-center gap-2 text-sm', className)}
    >
      <span aria-hidden="true" className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bg-muted-foreground/70 size-1.5 rounded-full motion-safe:animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}
