'use client';

import { Button } from '@cuelingo/ui/components/button';
import { ChatMessage } from '@cuelingo/ui/components/chat-message';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEventHandler } from 'react';
import { MAX_AGENT_MESSAGE_CHARS } from '@cuelingo/shared';
import type { DisplayMessage } from './chat-state';
import { STARTER_PROMPTS } from './starter-prompts';

/** Message box: Enter sends, Shift+Enter adds a line, and a key that finishes an IME word never sends. */
function Composer({
  sending,
  onSend,
  onStop,
}: {
  sending: boolean;
  onSend: (text: string) => Promise<boolean>;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !sending;

  const submit = async () => {
    if (!canSend) return;
    const sent = text;
    setText('');
    if (!(await onSend(sent))) setText(sent);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex items-end gap-2"
    >
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
        maxLength={MAX_AGENT_MESSAGE_CHARS}
        placeholder="Hỏi trợ lý về tiếng Anh công sở…"
        aria-label="Tin nhắn cho trợ lý"
        className="border-input bg-background focus-visible:ring-ring max-h-40 min-h-11 flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />
      {sending ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={onStop}>
          Dừng
        </Button>
      ) : (
        <Button type="submit" className="min-h-11" disabled={!canSend}>
          Gửi
        </Button>
      )}
    </form>
  );
}

/** Messages and the message box. Pure presentation: every action comes in as a prop. */
export function ChatView({
  messages,
  sending,
  error,
  loading,
  loadError,
  onSend,
  onStop,
  onDismissError,
  loadAudio,
  onWordDoubleClick,
}: {
  messages: DisplayMessage[];
  sending: boolean;
  error: string | null;
  loading: boolean;
  loadError: string | null;
  onSend: (text: string) => Promise<boolean>;
  onStop: () => void;
  onDismissError: () => void;
  loadAudio: (text: string) => Promise<Blob>;
  onWordDoubleClick: MouseEventHandler<HTMLElement>;
}) {
  const end = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  // Follow the reply while the person is at the bottom; stop following when they scroll up to read.
  useEffect(() => {
    const node = end.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      following.current = entry?.isIntersecting ?? true;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (following.current) end.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = async (text: string) => {
    following.current = true;
    return onSend(text);
  };

  const empty = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col gap-4">
      {loadError ? (
        <p role="alert" className="text-destructive text-sm">
          {loadError}
        </p>
      ) : null}
      {loading ? <p className="text-muted-foreground text-sm">Đang tải…</p> : null}

      {empty ? (
        <section aria-label="Gợi ý câu hỏi" className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Hỏi về từ vựng, cách diễn đạt hoặc chuẩn bị cho cuộc họp. Chọn một gợi ý hoặc tự gõ.
          </p>
          <ul className="grid gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  onClick={() => void send(prompt)}
                  className="border-input hover:bg-muted focus-visible:ring-ring min-h-11 w-full cursor-pointer rounded-lg border px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div role="log" aria-label="Cuộc trò chuyện" className="flex flex-col gap-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.key}
              role={message.role}
              parts={message.parts}
              status={message.status}
              loadAudio={loadAudio}
              onDoubleClick={message.role === 'assistant' ? onWordDoubleClick : undefined}
            />
          ))}
          <p className="text-muted-foreground text-xs">
            Nhấp đúp vào một từ trong câu trả lời để tra nghĩa, nghe hoặc lưu.
          </p>
        </div>
      )}
      <div ref={end} aria-hidden="true" />

      <div className="bg-background sticky bottom-0 -mx-1 space-y-2 px-1 pt-2 pb-1">
        {error ? (
          <div
            role="alert"
            className="bg-destructive/10 text-destructive flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={onDismissError}
              className="focus-visible:ring-ring min-h-8 shrink-0 cursor-pointer rounded px-1 text-xs font-medium underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Đóng
            </button>
          </div>
        ) : null}
        <Composer sending={sending} onSend={send} onStop={onStop} />
      </div>
    </div>
  );
}
