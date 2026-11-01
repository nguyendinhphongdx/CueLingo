import { Segmented } from '@cuelingo/ui/components/segmented';
import { useEffect, useRef } from 'react';
import { FONT_SIZE, OPACITY, type OverlayTheme } from './overlay-prefs';

const levels = [
  { value: '4', label: 'Đầy đủ' },
  { value: '3', label: 'Gợi ý' },
  { value: '1', label: 'Tối thiểu' },
  { value: '0', label: 'Ẩn' },
];

const hints: Record<string, string> = {
  '4': 'Tiếng Anh kèm bản dịch tiếng Việt',
  '3': 'Tiếng Anh là chính, dịch nhấn mạnh ý khó',
  '1': 'Chỉ bản dịch tiếng Việt',
  '0': 'Không hiện caption, vẫn ghi lại để debrief',
};

interface DisplayMenuProps {
  level: number;
  onLevel(level: number): void;
  fontSize: number;
  onFontSize(value: number): void;
  opacity: number;
  onOpacity(value: number): void;
  theme: OverlayTheme;
  onTheme(theme: OverlayTheme): void;
  onClose(): void;
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{label}</p>
        {value ? <p className="text-muted-foreground text-xs tabular-nums">{value}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Popover with the display choices: how much help, text size, background and its opacity. */
export function DisplayMenu(props: DisplayMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { onClose } = props;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Tuỳ chỉnh hiển thị"
      className="bg-card absolute top-12 right-3 z-30 w-[320px] max-w-[calc(100%-1.5rem)] space-y-5 rounded-xl border p-4 shadow-2xl"
    >
      <Field label="Mức hỗ trợ">
        <Segmented
          label="Mức hỗ trợ"
          value={String(props.level)}
          onChange={(value) => props.onLevel(Number(value))}
          options={levels}
        />
        <p className="text-muted-foreground text-xs">{hints[String(props.level)]}</p>
      </Field>
      <Field label="Cỡ chữ" value={`${props.fontSize} px`}>
        <input
          type="range"
          aria-label="Cỡ chữ"
          min={FONT_SIZE.min}
          max={FONT_SIZE.max}
          step={1}
          value={props.fontSize}
          onChange={(event) => props.onFontSize(Number(event.target.value))}
          className="accent-primary h-6 w-full cursor-pointer"
        />
      </Field>
      <Field label="Độ đậm nền" value={`${props.opacity}%`}>
        <input
          type="range"
          aria-label="Độ đậm nền"
          min={OPACITY.min}
          max={OPACITY.max}
          step={1}
          value={props.opacity}
          onChange={(event) => props.onOpacity(Number(event.target.value))}
          className="accent-primary h-6 w-full cursor-pointer"
        />
      </Field>
      <Field label="Giao diện">
        <Segmented
          label="Giao diện"
          value={props.theme}
          onChange={props.onTheme}
          options={[
            { value: 'dark', label: 'Tối' },
            { value: 'light', label: 'Sáng' },
          ]}
        />
      </Field>
    </div>
  );
}
