import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { cn } from '../lib/utils';

export interface LanguageOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Picks which language's learning data (or which meeting language) a screen shows. A native
 * `<select>` so keyboard, screen readers and mobile pickers work for free. With fewer than two
 * languages there is nothing to choose, so it renders nothing and screens stay as they were.
 */
export function LanguageSwitcher<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: LanguageOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const id = useId();
  if (options.length < 2) return null;
  return (
    <div className="relative inline-flex items-center">
      <label htmlFor={id} className="sr-only">
        Ngôn ngữ
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next) onChange(next.value);
        }}
        className={cn(
          'dark:bg-input/30 border-input h-9 min-w-0 cursor-pointer appearance-none rounded-md border bg-transparent py-1 pr-9 pl-3 text-base shadow-xs transition-colors outline-none md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute right-3 size-4"
      />
    </div>
  );
}
