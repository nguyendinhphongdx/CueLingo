// @vitest-environment jsdom
import type { Session, SessionDetail } from '@cuelingo/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const get = vi.hoisted(() => vi.fn());
vi.mock('../../lib/client', () => ({ client: { sessions: { get, list: vi.fn() } } }));

import { useDebounced } from '../../lib/use-debounced';
import { useSessionText } from './use-sessions';

const session = (id: string): Session => ({
  id,
  title: id,
  startedAt: '2026-11-01T08:00:00.000Z',
  endedAt: '2026-11-01T08:30:00.000Z',
  status: 'ended',
  assistLevel: 2,
  language: 'en',
});
const SESSIONS = [session('a'), session('b')];

let host: HTMLElement;
let root: Root;
let queryClient: QueryClient;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  get.mockReset();
  get.mockImplementation(
    async (id: string) => ({ ...session(id), segments: [], speakers: [] }) satisfies SessionDetail,
  );
  queryClient = new QueryClient();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('useSessionText', () => {
  it('does not fetch while disabled', async () => {
    function Probe() {
      useSessionText(SESSIONS, false);
      return null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps the same details map across renders while no meeting text changed', async () => {
    const seen: Array<Map<string, SessionDetail>> = [];
    function Probe({ tick }: { tick: number }) {
      seen.push(useSessionText(SESSIONS, true).details);
      return <span>{tick}</span>;
    }
    const render = (tick: number) =>
      act(async () =>
        root.render(
          <QueryClientProvider client={queryClient}>
            <Probe tick={tick} />
          </QueryClientProvider>,
        ),
      );
    await render(0);
    await vi.waitFor(() => expect(seen.at(-1)!.size).toBe(2));
    const settled = seen.at(-1)!;
    await render(1);
    await render(2);
    expect(seen.at(-1)).toBe(settled);
  });
});

describe('useDebounced', () => {
  it('settles on the last value only after the pause', () => {
    let value = '';
    function Probe({ text }: { text: string }) {
      value = useDebounced(text, 300);
      return null;
    }
    act(() => root.render(<Probe text="a" />));
    act(() => root.render(<Probe text="ab" />));
    act(() => root.render(<Probe text="abc" />));
    act(() => void vi.advanceTimersByTime(299));
    expect(value).toBe('a');
    act(() => void vi.advanceTimersByTime(2));
    expect(value).toBe('abc');
  });
});
