import { Segmented, type SegmentedOption } from './segmented';

/**
 * Picks which language's learning data (or which meeting language) a screen shows. With only one
 * language switched on there is nothing to choose, so it renders nothing and screens stay as they were.
 */
export function LanguageSwitcher<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  if (options.length < 2) return null;
  return (
    <Segmented
      label="Ngôn ngữ"
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
