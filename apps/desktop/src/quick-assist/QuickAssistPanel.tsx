import { SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import { IconButton } from '@cuelingo/ui/components/icon-button';
import { SpeakableOption } from '@cuelingo/ui/components/speakable-option';
import { ChevronRight, Maximize2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { studyApi } from '../study/study-api';
import { Teleprompter } from './Teleprompter';
import { meetingLanguage, meetingLearnable } from './use-quick-assist';
import type { QuickAssistActions, QuickAssistState } from './use-quick-assist';

interface QuickAssistPanelProps {
  state: QuickAssistState;
  actions: QuickAssistActions;
  /** The newest sentence the other side said; Nói giúp shows it so the reply fits. Never stored or logged. */
  asked?: string | null;
  /** Only the title bar shows; what the person typed and the results are kept. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const buttonClass =
  'focus-visible:ring-ring hover:bg-foreground/10 min-h-9 cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none';

/**
 * A drawer on the right of the captions, so the transcript stays in view while you work. The header
 * has a chevron that slides it away (what was typed is kept) and a cross that closes it for good.
 */
export function PanelFrame({
  title,
  close,
  onToggleCollapsed,
  children,
}: {
  title: string;
  close(): void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      className="bg-card flex h-full shrink-0 flex-col border-l"
      style={{ width: DRAWER_WIDTH }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <div className="flex h-11 shrink-0 items-center gap-1 pr-2 pl-4">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
        {onToggleCollapsed ? (
          <IconButton
            label={`Thu gọn ${title}`}
            title="Thu gọn"
            icon={<ChevronRight aria-hidden="true" className="size-4" />}
            onClick={onToggleCollapsed}
          />
        ) : null}
        <IconButton
          label={`Đóng ${title}`}
          title="Đóng"
          icon={<X aria-hidden="true" className="size-4" />}
          onClick={close}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 text-sm">{children}</div>
    </aside>
  );
}

function RequestError({ message, retry }: { message: string; retry(): void }) {
  return (
    <div role="alert" className="space-y-3">
      <p>{message}</p>
      <button type="button" className={buttonClass} onClick={retry}>
        Thử lại
      </button>
    </div>
  );
}

export const DRAWER_WIDTH = 320;

export function QuickAssistPanel({
  state,
  actions,
  asked,
  collapsed,
  onToggleCollapsed,
}: QuickAssistPanelProps) {
  const frame = { collapsed, onToggleCollapsed };
  // Which drafted sentence is shown in large type; the options themselves stay in `state`.
  const [bigIndex, setBigIndex] = useState<number | null>(null);
  const intentInput = useRef<HTMLInputElement>(null);
  const composeIdle = state.view === 'compose' && state.status === 'idle';
  useEffect(() => {
    if (composeIdle && !collapsed) intentInput.current?.focus();
  }, [composeIdle, collapsed]);
  useEffect(() => {
    if (state.view !== 'compose') setBigIndex(null);
  }, [state.view]);
  const languageName = SUPPORTED_LANGUAGES[meetingLanguage()].name.toLowerCase();
  // Slid away: nothing renders, but the hook keeps what was typed.
  if (collapsed) return null;
  if (state.view === 'closed') return null;

  if ((state.view === 'lookup' || state.view === 'compose') && !meetingLearnable()) {
    return (
      <PanelFrame
        title={state.view === 'lookup' ? `Tra từ: ${state.term}` : 'Nói giúp'}
        close={actions.close}
        {...frame}
      >
        <p>
          Tính năng này chưa hỗ trợ họp bằng {languageName}. Bạn vẫn dùng được "Họ vừa nói gì?".
        </p>
      </PanelFrame>
    );
  }

  if (state.view === 'lookup') {
    return (
      <PanelFrame title={`Tra từ: ${state.term}`} close={actions.close} {...frame}>
        {state.status === 'loading' ? (
          <p aria-live="polite">Đang tra nghĩa…</p>
        ) : state.status === 'error' ? (
          <RequestError
            message="Không thể tra từ lúc này. Vui lòng thử lại."
            retry={actions.retryLookup}
          />
        ) : state.result ? (
          <div aria-live="polite" className="space-y-3">
            <p className="text-base font-semibold">{state.result.meaningVi}</p>
            {state.result.reading ? (
              <p className="text-muted-foreground text-sm">{state.result.reading}</p>
            ) : null}
            {state.result.pos ? <p className="text-sm opacity-70">{state.result.pos}</p> : null}
            {state.result.exampleEn ? (
              <p>
                <span className="font-semibold">Ví dụ:</span> {state.result.exampleEn}
              </p>
            ) : null}
            {state.result.noteVi ? (
              <p>
                <span className="font-semibold">Ghi chú:</span> {state.result.noteVi}
              </p>
            ) : null}
          </div>
        ) : null}
      </PanelFrame>
    );
  }

  if (state.view === 'recap') {
    return (
      <PanelFrame title="Họ vừa nói gì?" close={actions.close} {...frame}>
        {state.status === 'loading' ? (
          <p aria-live="polite">Đang tóm tắt…</p>
        ) : state.status === 'error' ? (
          <RequestError
            message="Chưa thể tóm tắt. Hãy đợi thêm caption rồi thử lại."
            retry={actions.retryRecap}
          />
        ) : state.result ? (
          <div aria-live="polite" className="space-y-3">
            <p className="text-sm font-semibold">{state.result.summaryVi}</p>
            <ul className="list-disc space-y-1.5 pl-4">
              {state.result.bulletsVi.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </PanelFrame>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    actions.submitCompose();
  }

  return (
    <PanelFrame title="Nói giúp" close={actions.close} {...frame}>
      {asked ? (
        <p className="text-muted-foreground mb-3 line-clamp-3 text-sm">Họ vừa hỏi: “{asked}”</p>
      ) : null}
      <form className="space-y-2" onSubmit={submit}>
        <label htmlFor="compose-intent" className="text-muted-foreground block text-sm">
          Bạn muốn nói gì bằng {languageName}?
        </label>
        <div className="flex gap-2">
          <input
            id="compose-intent"
            ref={intentInput}
            aria-label="Ý muốn nói bằng tiếng Việt"
            className="border-input bg-background focus-visible:ring-ring min-h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            placeholder="Ví dụ: Tôi cần thêm một ngày để hoàn thành"
            value={state.intent}
            disabled={state.status === 'loading'}
            onChange={(event) => actions.setComposeIntent(event.target.value)}
          />
          <button
            type="submit"
            className={buttonClass}
            disabled={state.status === 'loading' || !state.intent.trim()}
          >
            {state.status === 'loading' ? 'Đang soạn…' : 'Soạn câu'}
          </button>
        </div>
      </form>

      {state.status === 'error' ? (
        <div className="mt-4">
          <RequestError
            message="Không thể soạn câu lúc này. Vui lòng thử lại."
            retry={actions.retryCompose}
          />
        </div>
      ) : null}

      {state.status === 'success' && state.result ? (
        <div aria-live="polite" className="mt-4 space-y-2.5">
          <p className="text-muted-foreground text-xs">Nghe thử, rồi sao chép câu bạn muốn nói:</p>
          {state.result.options.map((option, index) => (
            <div key={`${index}-${option.en}`} className="space-y-1">
              <SpeakableOption
                text={option.en}
                note={option.noteVi ?? undefined}
                loadAudio={studyApi.speak}
                onCopy={(text) => actions.copyOption(index, text)}
              />
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => setBigIndex(index)}
              >
                <Maximize2 aria-hidden="true" className="size-3.5" />
                Hiện chữ lớn
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {bigIndex !== null && state.status === 'success' && state.result?.options[bigIndex] ? (
        <Teleprompter
          text={state.result.options[bigIndex].en}
          note={state.result.options[bigIndex].noteVi ?? undefined}
          onBack={() => setBigIndex(null)}
          onCopy={(text) => actions.copyOption(bigIndex, text)}
        />
      ) : null}
    </PanelFrame>
  );
}
