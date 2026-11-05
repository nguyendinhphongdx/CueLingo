import type { MouseEventHandler } from 'react';
import type { AgentCardLike } from '../lib/agent-card';
import { cn } from '../lib/utils';
import { AgentCardView } from './agent-card-view';
import { MarkdownView } from './markdown-view';
import { ThinkingIndicator } from './thinking-indicator';
import { ToolStep, type ToolStepState } from './tool-step';

/** Mirrors `MessagePart` of `@cuelingo/shared` structurally; `@cuelingo/ui` does not import `shared`. */
export type ChatMessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool_step'; callId: string; tool: string; status: ToolStepState; summary?: string }
  | { type: 'card'; card: AgentCardLike };

export type ChatMessageStatus = 'streaming' | 'complete' | 'stopped' | 'error' | 'limited';

const ENDING_NOTES: Partial<Record<ChatMessageStatus, string>> = {
  stopped: 'Đã dừng trả lời.',
  error: 'Trợ lý chưa trả lời được. Hãy thử lại.',
  limited: 'Trợ lý dừng vì đạt giới hạn của lượt này. Bạn có thể nhắn tiếp để tiếp tục.',
};

/** Whether to show the "thinking" dots: nothing yet, or the last thing was a tool, so text is still to come. */
export function isAwaitingText(status: ChatMessageStatus, parts: ChatMessagePart[]): boolean {
  return status === 'streaming' && parts[parts.length - 1]?.type !== 'text';
}

/**
 * One message in the chat. The person's own text is plain; the assistant's is Markdown plus tool steps
 * and cards. `onDoubleClick` is given to the assistant's text so the page can offer word actions.
 */
export function ChatMessage({
  role,
  parts,
  status = 'complete',
  loadAudio,
  onDoubleClick,
  className,
}: {
  role: 'user' | 'assistant';
  parts: ChatMessagePart[];
  status?: ChatMessageStatus;
  loadAudio?: (text: string) => Promise<Blob>;
  onDoubleClick?: MouseEventHandler<HTMLElement>;
  className?: string;
}) {
  if (role === 'user') {
    const text = parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
    return (
      <article aria-label="Bạn" className={cn('flex justify-end', className)}>
        <p className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm break-words whitespace-pre-wrap">
          {text}
        </p>
      </article>
    );
  }

  const note = ENDING_NOTES[status];
  return (
    <article
      aria-label="Trợ lý"
      aria-busy={status === 'streaming'}
      onDoubleClick={onDoubleClick}
      data-chat-text=""
      className={cn('flex max-w-full flex-col items-start gap-2', className)}
    >
      {parts.map((part, index) =>
        part.type === 'text' ? (
          part.text ? (
            <MarkdownView key={index}>{part.text}</MarkdownView>
          ) : null
        ) : part.type === 'tool_step' ? (
          <ToolStep
            key={part.callId}
            tool={part.tool}
            status={part.status}
            summary={part.summary}
          />
        ) : (
          <AgentCardView key={index} card={part.card} loadAudio={loadAudio} />
        ),
      )}
      {isAwaitingText(status, parts) ? <ThinkingIndicator /> : null}
      {note ? (
        <p
          role={status === 'error' ? 'alert' : undefined}
          className={cn(
            'text-xs',
            status === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {note}
        </p>
      ) : null}
    </article>
  );
}
