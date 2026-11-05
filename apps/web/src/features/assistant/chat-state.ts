import type {
  ErrorCode,
  AgentStreamEvent,
  Message,
  MessagePart,
  MessageStatus,
} from '@cuelingo/shared';

/** The assistant's reply while it is still arriving. */
export interface DraftMessage {
  parts: MessagePart[];
  status: MessageStatus;
  /** Set by an `error` event; shown once the turn is settled. */
  errorCode: ErrorCode | null;
}

export const emptyDraft = (): DraftMessage => ({ parts: [], status: 'streaming', errorCode: null });

/** Folds one stream event into the draft. Pure, so the order rules live in one tested place. */
export function applyStreamEvent(draft: DraftMessage, event: AgentStreamEvent): DraftMessage {
  switch (event.type) {
    case 'status':
      return draft;
    case 'text_delta': {
      const last = draft.parts[draft.parts.length - 1];
      if (last?.type === 'text') {
        return {
          ...draft,
          parts: [...draft.parts.slice(0, -1), { type: 'text', text: last.text + event.text }],
        };
      }
      return { ...draft, parts: [...draft.parts, { type: 'text', text: event.text }] };
    }
    case 'tool_call':
      return {
        ...draft,
        parts: [
          ...draft.parts,
          { type: 'tool_step', callId: event.callId, tool: event.tool, status: 'running' },
        ],
      };
    case 'tool_result': {
      const status = event.ok ? 'ok' : 'error';
      const known = draft.parts.some((p) => p.type === 'tool_step' && p.callId === event.callId);
      const parts: MessagePart[] = known
        ? draft.parts.map((part) =>
            part.type === 'tool_step' && part.callId === event.callId
              ? { ...part, status, summary: event.summary }
              : part,
          )
        : [
            ...draft.parts,
            {
              type: 'tool_step',
              callId: event.callId,
              tool: event.tool,
              status,
              summary: event.summary,
            },
          ];
      return { ...draft, parts };
    }
    case 'card':
      return { ...draft, parts: [...draft.parts, { type: 'card', card: event.card }] };
    case 'error':
      return { ...draft, errorCode: event.code };
    case 'done':
      return { ...draft, status: event.status };
  }
}

/** What the chat draws for one message; `key` stays the same when a draft becomes the stored message. */
export interface DisplayMessage {
  key: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  status: MessageStatus;
}

export const messageKey = (seq: number) => `seq-${seq}`;

export function toDisplay(messages: Message[]): DisplayMessage[] {
  return messages.map((m) => ({
    key: messageKey(m.seq),
    role: m.role,
    parts: m.parts,
    status: m.status,
  }));
}

/** A turn that is being sent: the stored messages from before it, the user's text and the reply so far. */
export interface PendingTurn {
  /** The conversation the page was showing when the person sent (null: the "new chat" page). */
  viewId: string | null;
  /** The conversation the turn goes to; set once a new chat has been created. */
  targetId: string | null;
  base: Message[];
  userText: string;
  draft: DraftMessage;
}

export const isPendingVisible = (pending: PendingTurn | null, currentId: string | null): boolean =>
  pending !== null && (pending.viewId === currentId || pending.targetId === currentId);

/** Stored messages, plus the optimistic user message and the streaming reply when a turn is in flight. */
export function displayMessages(
  stored: Message[],
  pending: PendingTurn | null,
  currentId: string | null,
): DisplayMessage[] {
  if (!pending || !isPendingVisible(pending, currentId)) return toDisplay(stored);
  const next = (pending.base[pending.base.length - 1]?.seq ?? -1) + 1;
  return [
    ...toDisplay(pending.base),
    {
      key: messageKey(next),
      role: 'user',
      parts: [{ type: 'text', text: pending.userText }],
      status: 'complete',
    },
    {
      key: messageKey(next + 1),
      role: 'assistant',
      parts: pending.draft.parts,
      status: pending.draft.status,
    },
  ];
}

const SETTLE_ATTEMPTS = 5;
const SETTLE_DELAY_MS = 400;

/**
 * Reads the stored conversation after a turn. After `done` the final state is already saved, but when the
 * person pressed Stop the server writes `stopped` a moment after the connection closes, so a reply that
 * still says `streaming` is read again a few times. Returns the last read; null when none worked.
 */
export async function settleConversation(
  read: () => Promise<Message[]>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Message[] | null> {
  let latest: Message[] | null = null;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt++) {
    try {
      latest = await read();
    } catch {
      return latest;
    }
    if (latest[latest.length - 1]?.status !== 'streaming') return latest;
    await sleep(SETTLE_DELAY_MS);
  }
  return latest;
}
