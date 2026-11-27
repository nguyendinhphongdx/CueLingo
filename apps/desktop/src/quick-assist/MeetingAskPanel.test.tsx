// @vitest-environment jsdom
import { ApiError } from '@cuelingo/core-sdk';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTranscriptStore } from '../overlay/transcript-store';
import { MeetingAskPanel } from './MeetingAskPanel';
import type { MeetingAssistApi } from './meeting-assist-api';
import { useMeetingAsk, type MeetingAsk } from './use-meeting-ask';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SESSION = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';

function fakeApi(consent = true) {
  return {
    status: vi.fn(async () => ({ enabled: true, consent })),
    setConsent: vi.fn(async (granted: boolean) => ({ enabled: true, consent: granted })),
    ask: vi.fn<MeetingAssistApi['ask']>(async (_session, _body, { onEvent }) => {
      onEvent({ type: 'text_delta', text: 'Đăng nhập một lần [G]' });
      onEvent({ type: 'sources', items: [{ kind: 'general' }] });
      onEvent({ type: 'done', status: 'complete', questionId: SESSION });
    }),
  } satisfies MeetingAssistApi;
}

async function mount(api: MeetingAssistApi) {
  const seen = {} as { ask: MeetingAsk };
  function Probe() {
    seen.ask = useMeetingAsk({ listen: false, api });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(<Probe />));
  await act(async () => seen.ask.refresh());
  return seen;
}

const panel = (ask: MeetingAsk) => renderToStaticMarkup(<MeetingAskPanel ask={ask} />);

describe('meeting assistant drawer', () => {
  beforeEach(() => {
    useTranscriptStore.getState().reset();
    useTranscriptStore.getState().push({
      segmentId: SESSION,
      text: 'We need SSO.',
      translation: null,
      partial: false,
      sessionId: SESSION,
    });
  });

  it('is unavailable on a server without the route', async () => {
    const api = fakeApi();
    api.status.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'no route'));
    const seen = await mount(api);
    expect(seen.ask.state.availability).toBe('unavailable');
  });

  it('waits for the first caption before a question can be typed', async () => {
    useTranscriptStore.getState().reset();
    const seen = await mount(fakeApi());
    expect(panel(seen.ask)).toContain('Chờ caption đầu tiên');
  });

  it('asks for consent first, then sends the waiting question (AC15)', async () => {
    const api = fakeApi(false);
    const seen = await mount(api);
    await act(async () => seen.ask.ask('SSO là gì?'));
    expect(api.ask).not.toHaveBeenCalled();
    expect(panel(seen.ask)).toContain('Đồng ý và dùng trợ lý');
    await act(async () => {
      await seen.ask.agree();
    });
    expect(api.setConsent).toHaveBeenCalledWith(true);
    expect(api.ask).toHaveBeenCalledTimes(1);
  });

  it('sends the sentence pointed at and shows the answer with its source (AC5, AC11)', async () => {
    const api = fakeApi();
    const seen = await mount(api);
    await act(async () => seen.ask.setInput('SSO là gì?'));
    await act(async () => seen.ask.ask('SSO là gì?', { segmentId: 'not-a-uuid', text: 'We need' }));
    expect(api.ask.mock.calls[0]!.slice(0, 2)).toEqual([
      SESSION,
      { question: 'SSO là gì?', focus: { text: 'We need' } },
    ]);
    expect(seen.ask.state.input).toBe('');
    const markup = panel(seen.ask);
    expect(markup).toContain('Đăng nhập một lần');
    expect(markup).toContain('chưa kiểm chứng');
    expect(markup).not.toContain('[G]');
  });

  it('keeps what was typed when the question fails (AC14, AC19)', async () => {
    const api = fakeApi();
    api.ask.mockRejectedValue(new ApiError(429, 'QUOTA_EXCEEDED', 'x'));
    const seen = await mount(api);
    await act(async () => seen.ask.setInput('SSO là gì?'));
    await act(async () => seen.ask.ask('SSO là gì?'));
    expect(seen.ask.state.input).toBe('SSO là gì?');
    expect(panel(seen.ask)).toContain('đã dùng hết lượt hỏi trợ lý');
  });

  it('stops the answer without losing what arrived (AC4)', async () => {
    const api = fakeApi();
    let signal: AbortSignal | undefined;
    api.ask.mockImplementation(async (_session, _body, options) => {
      signal = options.signal;
      options.onEvent({ type: 'text_delta', text: 'một nửa' });
      await new Promise<void>((resolve) =>
        options.signal!.addEventListener('abort', () => resolve()),
      );
    });
    const seen = await mount(api);
    await act(async () => seen.ask.ask('SSO?'));
    await act(async () => seen.ask.stop());
    expect(signal!.aborted).toBe(true);
    expect(seen.ask.state.turn).toMatchObject({ text: 'một nửa', status: 'stopped' });
  });
});
