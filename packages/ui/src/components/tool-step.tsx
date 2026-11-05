import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export type ToolStepState = 'running' | 'ok' | 'error';

const LABELS: Record<string, Record<ToolStepState, string>> = {
  lookup_word: { running: 'Đang tra từ…', ok: 'Đã tra từ', error: 'Chưa tra được từ' },
  list_saved_phrases: {
    running: 'Đang xem cụm từ đã lưu…',
    ok: 'Đã xem cụm từ đã lưu',
    error: 'Chưa xem được cụm từ đã lưu',
  },
  save_phrase: {
    running: 'Đang lưu cụm từ…',
    ok: 'Đã lưu cụm từ',
    error: 'Chưa lưu được cụm từ',
  },
  show_card: { running: 'Đang tạo thẻ…', ok: 'Đã tạo thẻ', error: 'Chưa tạo được thẻ' },
};

const GENERIC: Record<ToolStepState, string> = {
  running: 'Đang dùng công cụ…',
  ok: 'Đã dùng công cụ',
  error: 'Công cụ gặp lỗi',
};

/** What a person reads for a tool step. An unknown tool (a plugin) gets a generic line, never its raw name. */
export function toolStepLabel(tool: string, status: ToolStepState): string {
  return (LABELS[tool] ?? GENERIC)[status];
}

/** One line showing what the assistant did besides writing: look a word up, save a phrase, build a card. */
export function ToolStep({
  tool,
  status,
  summary,
  className,
}: {
  tool: string;
  status: ToolStepState;
  /** One short sentence from the server about the result. */
  summary?: string;
  className?: string;
}) {
  const Icon = status === 'running' ? Loader2 : status === 'ok' ? Check : AlertCircle;
  return (
    <div
      data-status={status}
      className={cn(
        'bg-muted/60 text-muted-foreground flex w-fit max-w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs',
        status === 'error' && 'text-destructive',
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-3.5 shrink-0',
          status === 'running' && 'motion-safe:animate-spin',
        )}
      />
      <span>
        <span className="font-medium">{toolStepLabel(tool, status)}</span>
        {summary ? <span> · {summary}</span> : null}
      </span>
    </div>
  );
}
