import type { Debrief } from '@cuelingo/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PollHandlers } from './debrief-brief';

// A tiny stand-in for React: just enough to run the hook's effect by hand.
const react = vi.hoisted(() => ({
  state: undefined as unknown,
  effect: undefined as (() => void | (() => void)) | undefined,
}));
vi.mock('react', () => ({
  useState: (initial: unknown) => [
    react.state ?? initial,
    (value: unknown) => {
      react.state = value;
    },
  ],
  useEffect: (fn: () => void | (() => void)) => {
    react.effect = fn;
  },
}));

const polls = vi.hoisted(() => ({
  calls: [] as { id: string; handlers: unknown }[],
  cancels: [] as ReturnType<typeof vi.fn>[],
}));
vi.mock('./debrief-brief', () => ({
  pollDebrief: (_api: unknown, id: string, handlers: unknown) => {
    const cancel = vi.fn();
    polls.calls.push({ id, handlers });
    polls.cancels.push(cancel);
    return cancel;
  },
}));
vi.mock('./debrief-api', () => ({ debriefApi: {} }));

import { useDebriefBrief } from './use-debrief-brief';

const debrief = { id: 'd' } as Debrief;

describe('useDebriefBrief', () => {
  beforeEach(() => {
    react.state = undefined;
    react.effect = undefined;
    polls.calls.length = 0;
    polls.cancels.length = 0;
  });

  it('does not poll without a meeting id', () => {
    expect(useDebriefBrief(null)).toEqual({ status: 'pending' });
    react.effect!();
    expect(polls.calls).toHaveLength(0);
  });

  it('stops the old poll when the meeting changes and when it unmounts', () => {
    useDebriefBrief('a');
    const cleanupA = react.effect!() as () => void;
    expect(polls.calls.map((c) => c.id)).toEqual(['a']);

    // React runs the cleanup of the old effect before the effect for the new id.
    cleanupA();
    expect(polls.cancels[0]).toHaveBeenCalledOnce();
    useDebriefBrief('b');
    const cleanupB = react.effect!() as () => void;
    expect(polls.calls.map((c) => c.id)).toEqual(['a', 'b']);

    cleanupB();
    expect(polls.cancels[1]).toHaveBeenCalledOnce();
  });

  it('shows the result only for the meeting it belongs to', () => {
    useDebriefBrief('a');
    react.effect!();
    (polls.calls[0]!.handlers as PollHandlers).onReady(debrief);
    expect(useDebriefBrief('a')).toEqual({ status: 'ready', debrief });
    expect(useDebriefBrief('b')).toEqual({ status: 'pending' });
  });
});
