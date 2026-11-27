import { stripSourceTags, type MeetingAnswerSource } from '@cuelingo/shared';
import { formatDateVn } from '../lib/usage';
import { Badge } from './badge';
import { Button } from './button';
import { MarkdownView } from './markdown-view';

export type MeetingAnswerState = 'searching' | 'answering' | 'complete' | 'stopped' | 'error';

/** The wording of a source label under an answer. */
export function meetingSourceLabel(source: MeetingAnswerSource): string {
  switch (source.kind) {
    case 'current_meeting':
      return 'Cuộc họp này';
    case 'past_meeting':
      return `Cuộc họp ${source.title ? `“${source.title}”, ` : ''}${formatDateVn(source.startedAt)}`;
    case 'glossary':
      return 'Thuật ngữ';
    case 'phrases':
      return 'Cụm từ đã lưu';
    case 'general':
      return 'Kiến thức chung (chưa kiểm chứng)';
  }
}

/** One question asked during a meeting and its answer as it arrives, with where the answer came from. */
export function MeetingAnswer({
  question,
  text,
  status,
  sources = [],
  errorMessage,
  onStop,
  onRetry,
  onMore,
}: {
  question: string;
  text: string;
  status: MeetingAnswerState;
  sources?: MeetingAnswerSource[];
  errorMessage?: string;
  onStop?(): void;
  onRetry?(): void;
  /** Ask for a longer explanation of the same question. */
  onMore?(): void;
}) {
  const busy = status === 'searching' || status === 'answering';
  const shown = stripSourceTags(text);

  return (
    <article className="space-y-2.5 select-text">
      <p className="text-muted-foreground text-sm">{question}</p>
      <div aria-live="polite" aria-busy={busy}>
        {shown ? <MarkdownView>{shown}</MarkdownView> : null}
        {busy && !shown ? (
          <p className="text-muted-foreground animate-pulse">
            {status === 'searching' ? 'Đang tìm trong dữ liệu của bạn…' : 'Đang trả lời…'}
          </p>
        ) : null}
        {status === 'stopped' ? <p className="text-muted-foreground text-xs">Đã dừng.</p> : null}
      </div>
      {status === 'error' ? (
        <p role="alert">{errorMessage ?? 'Không trả lời được lúc này.'}</p>
      ) : null}
      {sources.length > 0 ? (
        <ul aria-label="Nguồn" className="flex flex-wrap gap-1.5">
          {sources.map((source, index) => (
            <li key={`${source.kind}-${index}`}>
              <Badge variant={source.kind === 'general' ? 'warning' : undefined}>
                {meetingSourceLabel(source)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {busy && onStop ? (
          <Button size="sm" variant="outline" onClick={onStop}>
            Dừng
          </Button>
        ) : null}
        {status === 'error' && onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Thử lại
          </Button>
        ) : null}
        {status === 'complete' && onMore ? (
          <Button size="sm" variant="ghost" onClick={onMore}>
            Giải thích thêm
          </Button>
        ) : null}
      </div>
    </article>
  );
}
