import { MEETING_QUESTION_MAX } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { MeetingAnswer } from '@cuelingo/ui/components/meeting-answer';
import { useState, type FormEvent } from 'react';
import { DRAWER_WIDTH, PanelFrame } from './QuickAssistPanel';
import { lastSentence, type MeetingAsk } from './use-meeting-ask';

export const CONSENT_TEXT =
  'Mỗi khi bạn hỏi, CueLingo gửi câu hỏi, phần transcript liên quan của cuộc họp này, thuật ngữ, cụm từ đã lưu và trích đoạn cuộc họp cũ của bạn tới Google (Gemini) để trả lời. Câu hỏi và câu trả lời được lưu cùng cuộc họp; bạn xoá hoặc xuất được. Hãy báo cho người cùng họp nếu quy định nơi bạn làm việc yêu cầu.';

const SUGGESTIONS = ['Giải thích câu cuối', 'Lần trước bàn gì về việc này?'];

/** The "Hỏi trợ lý" drawer: consent the first time, then a question box and one answer. */
export function MeetingAskPanel({
  ask,
  onToggleCollapsed,
}: {
  ask: MeetingAsk;
  onToggleCollapsed?: () => void;
}) {
  const { state, sessionId } = ask;
  const [agreeFailed, setAgreeFailed] = useState(false);
  const waiting = !sessionId;
  const busy = state.turn?.status === 'searching' || state.turn?.status === 'answering';

  function submit(event: FormEvent) {
    event.preventDefault();
    ask.ask(state.input);
  }

  return (
    <PanelFrame title="Hỏi trợ lý" close={ask.close} onToggleCollapsed={onToggleCollapsed}>
      {state.consent === false ? (
        <div className="space-y-3">
          <p className="leading-relaxed">{CONSENT_TEXT}</p>
          <Button size="sm" onClick={() => void ask.agree().then((ok) => setAgreeFailed(!ok))}>
            Đồng ý và dùng trợ lý
          </Button>
          {agreeFailed ? <p role="alert">Chưa lưu được lựa chọn của bạn. Thử lại.</p> : null}
        </div>
      ) : (
        <div className="space-y-4" style={{ maxWidth: DRAWER_WIDTH }}>
          <form className="space-y-2" onSubmit={submit}>
            <label htmlFor="meeting-question" className="text-muted-foreground block text-sm">
              {waiting ? 'Chờ caption đầu tiên' : 'Bạn muốn biết gì về cuộc họp?'}
            </label>
            <div className="flex gap-2">
              <input
                id="meeting-question"
                // The drawer opens because the person wants to type.
                autoFocus
                className="border-input bg-background focus-visible:ring-ring min-h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                placeholder="Ví dụ: SSO là gì?"
                maxLength={MEETING_QUESTION_MAX}
                value={state.input}
                disabled={waiting}
                onChange={(event) => ask.setInput(event.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                className="min-h-9"
                disabled={waiting || busy || !state.input.trim()}
              >
                Hỏi
              </Button>
            </div>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                size="sm"
                variant="outline"
                disabled={waiting || busy}
                onClick={() => ask.ask(suggestion, lastSentence())}
              >
                {suggestion}
              </Button>
            ))}
          </div>
          {state.turn ? (
            <MeetingAnswer
              question={state.turn.question}
              text={state.turn.text}
              status={state.turn.status}
              sources={state.turn.sources}
              errorMessage={state.turn.error}
              onStop={ask.stop}
              onRetry={ask.retry}
              onMore={state.turn.detail ? undefined : ask.more}
            />
          ) : null}
        </div>
      )}
    </PanelFrame>
  );
}
