// @vitest-environment jsdom
import type { Session, SessionDetail } from '@cuelingo/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), remove: vi.fn() }));
vi.mock('./sessions-api', () => ({ sessionsApi: api }));
vi.mock('./session-actions', () => ({ openDebrief: vi.fn() }));

import { MeetingsPage } from './MeetingsPage';

const SPEAKER_ID = '11111111-1111-4111-8111-111111111111';
const session = (id: string, startedAt: string, title: string | null): Session => ({
  id,
  title,
  startedAt,
  endedAt: new Date(Date.parse(startedAt) + 1_800_000).toISOString(),
  status: 'debriefed',
  assistLevel: 3,
  language: 'en',
});
const NOV = session(
  'a0000000-0000-4000-8000-000000000001',
  '2026-11-03T08:00:00.000Z',
  'Weekly sync',
);
const OCT = session('a0000000-0000-4000-8000-000000000002', '2026-10-20T08:00:00.000Z', 'Design');
const detail = (base: Session, text: string, who: 'me' | 'lan'): SessionDetail => ({
  ...base,
  speakers: [{ id: SPEAKER_ID, label: 'speaker_1', displayName: 'Lan' }],
  segments: [
    {
      id: '00000000-0000-4000-8000-000000000000',
      source: who === 'me' ? 'mic' : 'system',
      startMs: 0,
      endMs: 900,
      textEn: text,
      textVi: null,
      speakerId: who === 'lan' ? SPEAKER_ID : null,
    },
  ],
});

let host: HTMLElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  api.list.mockResolvedValue({ sessions: [NOV, OCT] });
  api.get.mockImplementation(async (id: string) =>
    id === NOV.id
      ? detail(NOV, 'We need to ship the budget report', 'lan')
      : detail(OCT, 'The budget is approved', 'me'),
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const render = () =>
  act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MeetingsPage />
      </QueryClientProvider>,
    ),
  );
const type = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const choose = async (select: HTMLSelectElement, value: string) => {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    set.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};
const field = (label: string) => host.querySelector(`[aria-label="${label}"]`)!;

describe('MeetingsPage search (AC10)', () => {
  it('lists every meeting and reads no text until a search or speaker filter is used', async () => {
    await render();
    await vi.waitFor(() => expect(host.textContent).toContain('Weekly sync'));
    expect(host.textContent).toContain('Design');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('waits for typing to pause, then shows matching lines with the word marked', async () => {
    await render();
    await vi.waitFor(() => expect(host.textContent).toContain('Weekly sync'));
    await type(field('Tìm trong cuộc họp') as HTMLInputElement, 'budget');
    expect(api.get).not.toHaveBeenCalled();
    await act(async () => void (await vi.advanceTimersByTimeAsync(350)));
    await vi.waitFor(() => expect(host.querySelectorAll('mark').length).toBeGreaterThan(0));
    expect(host.textContent).toContain('Lan: ');
    expect(host.textContent).toContain('2 cuộc họp khớp');

    await choose(field('Lọc theo người nói') as HTMLSelectElement, 'Lan');
    expect(host.textContent).toContain('Weekly sync');
    expect(host.textContent).not.toContain('Design');
    expect(host.textContent).toContain('1 cuộc họp khớp');
  });

  it('filters by month and by speaker, and says nothing matched', async () => {
    await render();
    await vi.waitFor(() => expect(host.textContent).toContain('Weekly sync'));
    await choose(field('Lọc theo tháng') as HTMLSelectElement, '2026-10');
    expect(host.textContent).toContain('Design');
    expect(host.textContent).not.toContain('Weekly sync');

    await choose(field('Lọc theo tháng') as HTMLSelectElement, '');
    await choose(field('Lọc theo người nói') as HTMLSelectElement, '');
    await type(field('Tìm trong cuộc họp') as HTMLInputElement, 'zzzz');
    await act(async () => void (await vi.advanceTimersByTimeAsync(350)));
    await vi.waitFor(() => expect(host.textContent).toContain('Không có cuộc họp nào khớp'));
  });
});
