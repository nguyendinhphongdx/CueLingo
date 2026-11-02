import { TrendingDown, TrendingUp } from 'lucide-react';
import { assistLevelLabel } from '../lib/assist-levels';
import { Button } from './button';

export interface AssistSuggestionView {
  kind: 'lower' | 'raise';
  currentLevel: number;
  suggestedLevel: number;
  meetingsConsidered: number;
  avgComprehensionPct: number;
}

/**
 * A quiet offer to change how much the captions help. Both choices are equal and either one ends the
 * question; nothing changes unless the person accepts.
 */
export function AssistSuggestionCard({
  suggestion,
  busy = false,
  onApply,
  onLater,
}: {
  suggestion: AssistSuggestionView;
  busy?: boolean;
  onApply(): void;
  onLater(): void;
}) {
  const lower = suggestion.kind === 'lower';
  const Icon = lower ? TrendingDown : TrendingUp;
  const target = assistLevelLabel(suggestion.suggestedLevel);

  return (
    <section
      aria-labelledby="assist-suggestion-title"
      className="bg-card flex items-start gap-3 rounded-xl border p-4"
    >
      <Icon aria-hidden="true" className="text-primary mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 id="assist-suggestion-title" className="text-sm font-semibold">
          {lower ? 'Bạn nghe tốt hơn rồi' : 'Cuộc họp gần đây còn khó'}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {lower
            ? `${suggestion.meetingsConsidered} cuộc họp gần nhất bạn hiểu trung bình ${suggestion.avgComprehensionPct}%. Thử giảm hỗ trợ xuống “${target}” để tập nghe nhiều hơn?`
            : `${suggestion.meetingsConsidered} cuộc họp gần nhất bạn hiểu khoảng ${suggestion.avgComprehensionPct}%. Tăng hỗ trợ lên “${target}” để theo kịp dễ hơn?`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className="cursor-pointer" disabled={busy} onClick={onApply}>
            Chuyển sang “{target}”
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer"
            disabled={busy}
            onClick={onLater}
          >
            Để sau
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Bạn đổi lại được bất cứ lúc nào. Sẽ không hỏi lại trong 7 ngày.
        </p>
      </div>
    </section>
  );
}
