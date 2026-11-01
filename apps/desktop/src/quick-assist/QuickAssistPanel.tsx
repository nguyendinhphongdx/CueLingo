import type { FormEvent, ReactNode } from 'react';
import type { QuickAssistActions, QuickAssistState } from './use-quick-assist';

interface QuickAssistPanelProps {
  state: QuickAssistState;
  actions: QuickAssistActions;
}

const buttonClass =
  'min-h-11 cursor-pointer rounded-lg border border-current/20 px-4 py-2 text-sm font-semibold text-inherit hover:bg-current/10 focus-visible:ring-2 focus-visible:outline-none';

function PanelFrame({
  title,
  close,
  children,
}: {
  title: string;
  close(): void;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={title}
      className="absolute inset-x-3 top-20 bottom-3 z-20 overflow-y-auto rounded-xl border border-current/20 bg-inherit p-4 text-inherit shadow-2xl"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" aria-label={`Đóng ${title}`} className={buttonClass} onClick={close}>
          Đóng
        </button>
      </div>
      {children}
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

export function QuickAssistPanel({ state, actions }: QuickAssistPanelProps) {
  if (state.view === 'closed') return null;

  if (state.view === 'lookup') {
    return (
      <PanelFrame title={`Tra từ: ${state.term}`} close={actions.close}>
        {state.status === 'loading' ? (
          <p aria-live="polite">Đang tra nghĩa…</p>
        ) : state.status === 'error' ? (
          <RequestError
            message="Không thể tra từ lúc này. Vui lòng thử lại."
            retry={actions.retryLookup}
          />
        ) : state.result ? (
          <div aria-live="polite" className="space-y-3">
            <p className="text-xl font-bold">{state.result.meaningVi}</p>
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
      <PanelFrame title="Họ vừa nói gì?" close={actions.close}>
        {state.status === 'loading' ? (
          <p aria-live="polite">Đang tóm tắt…</p>
        ) : state.status === 'error' ? (
          <RequestError
            message="Chưa thể tóm tắt. Hãy đợi thêm caption rồi thử lại."
            retry={actions.retryRecap}
          />
        ) : state.result ? (
          <div aria-live="polite" className="space-y-3">
            <p className="text-lg font-semibold">{state.result.summaryVi}</p>
            <ul className="list-disc space-y-2 pl-5">
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
    <PanelFrame title="Nói giúp" close={actions.close}>
      <form className="space-y-3" onSubmit={submit}>
        <label htmlFor="compose-intent" className="block font-semibold">
          Bạn muốn nói gì bằng tiếng Anh?
        </label>
        <input
          id="compose-intent"
          aria-label="Ý muốn nói bằng tiếng Việt"
          className="min-h-11 w-full rounded-lg border border-current/30 bg-transparent px-3 text-base text-inherit placeholder:text-inherit/60 focus-visible:ring-2 focus-visible:outline-none"
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
        <div aria-live="polite" className="mt-5 space-y-3">
          <p className="font-semibold">Chọn một câu để nói:</p>
          {state.result.options.map((option, index) => (
            <div key={`${index}-${option.en}`} className="space-y-2">
              <button
                type="button"
                aria-pressed={state.selectedIndex === index}
                className={`min-h-11 w-full cursor-pointer rounded-xl border px-4 py-3 text-left text-xl leading-relaxed text-inherit focus-visible:ring-2 focus-visible:outline-none ${
                  state.selectedIndex === index
                    ? 'border-current bg-current/10'
                    : 'border-current/20 hover:bg-current/5'
                }`}
                onClick={() => actions.selectOption(index)}
              >
                {option.en}
                {option.noteVi ? (
                  <span className="mt-1 block text-sm opacity-70">{option.noteVi}</span>
                ) : null}
              </button>
              {state.selectedIndex === index ? (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => actions.copyOption(option.en)}
                >
                  Sao chép câu đã chọn
                </button>
              ) : null}
            </div>
          ))}
          {state.copyStatus === 'copied' ? <p>Đã sao chép.</p> : null}
          {state.copyStatus === 'error' ? (
            <p role="alert">Không thể sao chép. Vui lòng thử lại.</p>
          ) : null}
        </div>
      ) : null}
    </PanelFrame>
  );
}
