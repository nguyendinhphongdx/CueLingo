import { Highlight, HighlightItem } from '@animate-ui/react/primitives/effects/highlight';
import { spring } from '@animate-ui/react/utils/motion';
import { useAssistSettings } from './use-assist-settings';

const options = [
  { level: 4, label: 'Đầy đủ', hint: 'Caption tiếng Anh kèm bản dịch tiếng Việt' },
  { level: 3, label: 'Gợi ý', hint: 'Tiếng Anh là chính, dịch nhấn mạnh ý khó' },
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
      <div role="group" aria-label="Mức hỗ trợ" className="bg-muted rounded-xl p-1">
        <Highlight
          value={String(assistLevel)}
          hover={false}
          transition={spring.pop}
          className="bg-card rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10"
          containerClassName="grid grid-cols-4"
          mode="parent"
        >
          {options.map((option) => {
            const active = assistLevel === option.level;
            return (
              <HighlightItem key={option.level} value={String(option.level)}>
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={saving}
                  onClick={() => setAssistLevel(option.level)}
                  className={`focus-visible:ring-ring h-9 w-full cursor-pointer rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default ${
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.level} · {option.label}
                </button>
              </HighlightItem>
            );
          })}
        </Highlight>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
