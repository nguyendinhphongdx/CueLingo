import { Highlight, HighlightItem } from '@animate-ui/react/primitives/effects/highlight';
import { spring } from '@animate-ui/react/utils/motion';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Segmented control with a sliding highlight; a native radio-like group for keyboard users. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="bg-muted rounded-xl p-1">
      <Highlight
        value={value}
        hover={false}
        transition={spring.pop}
        className="bg-card rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10"
        containerClassName="grid"
        mode="parent"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <HighlightItem key={option.value} value={option.value}>
              <button
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={`focus-visible:ring-ring h-9 w-full cursor-pointer rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default ${
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            </HighlightItem>
          );
        })}
      </Highlight>
    </div>
  );
}
