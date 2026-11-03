import type { Debrief } from '@cuelingo/shared';
import type { DebriefApi, DebriefError } from './debrief-api';

export const POLL_INTERVAL_MS = 3_000;
export const POLL_TIMEOUT_MS = 120_000;

/**
 * Asks for the debrief now and every POLL_INTERVAL_MS until it exists or POLL_TIMEOUT_MS passes.
 * Errors count as "not yet". Returns a function that stops it for good.
 */
export interface PollHandlers {
  onReady(debrief: Debrief): void;
  onTimeout(): void;
  /** The person is not allowed to read it (401/403): asking again cannot help. */
  onDenied(): void;
}

export function pollDebrief(
  api: Pick<DebriefApi, 'get'>,
  sessionId: string,
  { onReady, onTimeout, onDenied }: PollHandlers,
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const abort = new AbortController();
  const startedAt = Date.now();

  async function attempt() {
    timer = null;
    let denied = false;
    const found = await api.get(sessionId, abort.signal).catch((error: unknown) => {
      const status = (error as Partial<DebriefError> | null)?.status;
      denied = status === 401 || status === 403;
      return null;
    });
    if (cancelled) return;
    if (denied) {
      onDenied();
      return;
    }
    if (found) {
      onReady(found);
      return;
    }
    if (Date.now() - startedAt + POLL_INTERVAL_MS > POLL_TIMEOUT_MS) {
      onTimeout();
      return;
    }
    timer = setTimeout(() => void attempt(), POLL_INTERVAL_MS);
  }

  void attempt();
  return () => {
    cancelled = true;
    abort.abort();
    if (timer) clearTimeout(timer);
  };
}

const MAX_ITEMS = 3;
const MAX_SUMMARY_LINES = 3;

export interface BriefList {
  shown: string[];
  more: number;
}

export interface DebriefBrief {
  summary: string[];
  decisions: BriefList;
  todos: BriefList;
}

function list(items: string[]): BriefList {
  return { shown: items.slice(0, MAX_ITEMS), more: Math.max(0, items.length - MAX_ITEMS) };
}

/** The short form shown right after a meeting: 3 summary lines, up to 3 decisions and 3 to-dos. */
export function summariseDebrief(debrief: Debrief): DebriefBrief {
  const text = (value: string) => value.trim();
  const summary = [debrief.summary.headlineVi, ...debrief.summary.bulletsVi]
    .map(text)
    .filter(Boolean)
    .slice(0, MAX_SUMMARY_LINES);
  const byKind = (kind: 'decision' | 'todo') =>
    debrief.actionItems
      .filter((item) => item.kind === kind)
      .map((item) => (item.owner ? `${text(item.textVi)} (${item.owner})` : text(item.textVi)))
      .filter(Boolean);
  return { summary, decisions: list(byKind('decision')), todos: list(byKind('todo')) };
}
