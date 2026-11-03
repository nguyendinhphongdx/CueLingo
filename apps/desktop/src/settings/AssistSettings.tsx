import type { SelectableAssistLevel } from './settings-store';
import { Segmented } from '@cuelingo/ui/components/segmented';
import { useAssistSettings } from './use-assist-settings';

const options = [
  { level: 4, label: 'Đầy đủ', hint: 'Caption gốc kèm bản dịch tiếng Việt' },
  { level: 3, label: 'Gợi ý', hint: 'Chữ gốc là chính, dịch nhấn mạnh ý khó' },
  { level: 1, label: 'Tối thiểu', hint: 'Chỉ bản dịch tiếng Việt' },
  { level: 0, label: 'Ẩn', hint: 'Không hiện caption, vẫn ghi lại để debrief' },
] as const;

/** Segmented control for how much help the caption gives. */
export function AssistSettings() {
  const { assistLevel, setAssistLevel, saving, error } = useAssistSettings();
  const current = options.find((option) => option.level === assistLevel) ?? options[0];

  return (
    <section aria-labelledby="assist-title" className="space-y-3">
      <div>
        <h2 id="assist-title" className="text-sm font-semibold">
          Mức hỗ trợ
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">{current.hint}</p>
      </div>
      <Segmented
        label="Mức hỗ trợ"
        value={String(assistLevel)}
        disabled={saving}
        onChange={(value) => setAssistLevel(Number(value) as SelectableAssistLevel)}
        options={options.map((option) => ({
          value: String(option.level),
          label: `${option.level} · ${option.label}`,
        }))}
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
