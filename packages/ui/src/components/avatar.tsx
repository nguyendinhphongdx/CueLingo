import { cn } from '../lib/utils';

export type AvatarSize = 'sm' | 'md' | 'lg';

const sizes: Record<AvatarSize, string> = {
  sm: 'size-8 text-sm',
  md: 'size-9 text-sm',
  lg: 'size-14 text-xl',
};

/** First letter of the name (or the email when there is no name), upper-cased in Vietnamese. */
export const initialOf = (name: string | null | undefined, email?: string | null): string =>
  ((name ?? '').trim() || (email ?? '').trim() || '?').charAt(0).toLocaleUpperCase('vi');

/** The round initial that stands for a person everywhere in the product. */
export function Avatar({
  name,
  email,
  size = 'md',
  className,
}: {
  name?: string | null;
  email?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-foreground text-background flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizes[size],
        className,
      )}
    >
      {initialOf(name, email)}
    </span>
  );
}
