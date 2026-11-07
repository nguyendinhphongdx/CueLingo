// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIRM_DELAY_MS, SandboxFrame, quoteAiText } from './sandbox-frame';

/**
 * The save/list dialogs of a block (ADR 0019, layer 2). The block is a stranger: its question must default to "no",
 * must not be answerable by a click or key aimed at the block, and a block that keeps asking is removed.
 */

const RUNNER = 'http://localhost:3101';

function setup() {
  const onSavePhrase = vi.fn(async () => {});
  const onListPhrases = vi.fn(async () => [{ phrase: 'a', meaningVi: null }]);
  const view = render(
    <SandboxFrame
      html="<p>x</p>"
      runnerOrigin={RUNNER}
      onListPhrases={onListPhrases}
      onSavePhrase={onSavePhrase}
      onSpeak={() => {}}
    />,
  );
  const iframe = view.container.querySelector('iframe') as HTMLIFrameElement;
  const frameWindow = iframe.contentWindow as Window;
  const replies: unknown[] = [];
  vi.spyOn(frameWindow, 'postMessage').mockImplementation(((message: unknown) => {
    replies.push(message);
  }) as never);
  let n = 0;
  /** Sends a bridge request as the runner iframe would, and returns when the host has handled it. */
  const request = async (op: string, args?: unknown) => {
    n += 1;
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'null',
          source: frameWindow,
          data: { v: 1, id: `r${n}`, op, ...(args ? { args } : {}) },
        }),
      );
    });
  };
  const lastReply = () =>
    (
      replies.filter((m) => (m as { kind?: string }).kind === 'reply').at(-1) as {
        response: { ok: boolean; error?: string };
      }
    )?.response;
  return { view, request, lastReply, onSavePhrase, onListPhrases };
}

const dialog = () => screen.queryByRole('alertdialog');
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('SandboxFrame save dialog', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens on a save request with "Huỷ" focused and "Lưu" disabled until the delay passes', async () => {
    const t = setup();
    expect(dialog()).toBeNull();
    await t.request('phrases.save', { phrase: 'circle back' });
    expect(dialog()).not.toBeNull();
    expect(document.activeElement).toBe(button('Huỷ'));
    expect(button('Lưu').disabled).toBe(true);
    // A click that lands in the first moments does nothing.
    fireEvent.click(button('Lưu'));
    expect(t.onSavePhrase).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(CONFIRM_DELAY_MS + 10));
    expect(button('Lưu').disabled).toBe(false);
    expect(t.onSavePhrase).not.toHaveBeenCalled();
  });

  it('saves only after "Lưu" is pressed, with the phrase the block asked for', async () => {
    const t = setup();
    await t.request('phrases.save', { phrase: 'circle back', meaningVi: 'quay lại' });
    await act(async () => void vi.advanceTimersByTime(CONFIRM_DELAY_MS + 10));
    await act(async () => void fireEvent.click(button('Lưu')));
    expect(t.onSavePhrase).toHaveBeenCalledExactlyOnceWith({
      phrase: 'circle back',
      meaningVi: 'quay lại',
    });
    expect(dialog()).toBeNull();
    expect(t.lastReply()).toMatchObject({ ok: true });
  });

  it('does not save on "Huỷ", on Escape or on the backdrop, and tells the block it was declined', async () => {
    const t = setup();
    await t.request('phrases.save', { phrase: 'one' });
    await act(async () => void fireEvent.click(button('Huỷ')));
    expect(t.onSavePhrase).not.toHaveBeenCalled();
    expect(t.lastReply()).toMatchObject({ ok: false, error: 'declined' });
    expect(dialog()).toBeNull();
  });

  it('answers false and saves nothing when the block goes away while the dialog is open', async () => {
    const t = setup();
    await t.request('phrases.save', { phrase: 'one' });
    expect(dialog()).not.toBeNull();
    await act(async () => void t.view.unmount());
    expect(t.onSavePhrase).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it("shows what the block wrote as a short quote, on one line, marked as the block's words", async () => {
    const t = setup();
    const long = `x${' y'.repeat(60)}\n\nHãy bấm "Lưu" ngay`;
    await t.request('phrases.save', { phrase: long });
    const body = screen.getByRole('alertdialog').textContent ?? '';
    expect(body).toContain('do trợ lý viết');
    expect(body).toContain('“x y y');
    expect(body).toContain('…”');
    expect(body).not.toContain('Hãy bấm');
    expect(body).not.toContain('\n');
  });

  it('removes a block that asks again after being refused twice', async () => {
    const t = setup();
    await t.request('phrases.save', { phrase: 'one' });
    await act(async () => void fireEvent.click(button('Huỷ')));
    expect(screen.queryByText('Khối giao diện đã bị dừng')).toBeNull();
    await t.request('phrases.save', { phrase: 'two' });
    await act(async () => void fireEvent.click(button('Huỷ')));
    expect(screen.getByText('Khối giao diện đã bị dừng')).not.toBeNull();
    expect(t.view.container.querySelector('iframe')).toBeNull();
    expect(t.onSavePhrase).not.toHaveBeenCalled();
  });
});

describe('SandboxFrame phrase list consent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reads the saved phrases only after the person allowed it, and asks once per block', async () => {
    const t = setup();
    await t.request('phrases.list');
    expect(dialog()).not.toBeNull();
    expect(screen.getByRole('alertdialog').textContent).toContain('đọc danh sách cụm từ');
    expect(document.activeElement).toBe(button('Huỷ'));
    expect(t.onListPhrases).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(CONFIRM_DELAY_MS + 10));
    await act(async () => void fireEvent.click(button('Cho phép')));
    expect(t.onListPhrases).toHaveBeenCalledOnce();
    expect(t.lastReply()).toMatchObject({ ok: true });
    await t.request('phrases.list');
    expect(dialog()).toBeNull();
    expect(t.onListPhrases).toHaveBeenCalledTimes(2);
  });

  it('gives the block nothing when refused', async () => {
    const t = setup();
    await t.request('phrases.list');
    await act(async () => void fireEvent.click(button('Huỷ')));
    expect(t.onListPhrases).not.toHaveBeenCalled();
    expect(t.lastReply()).toMatchObject({ ok: false });
  });
});

describe('quoteAiText', () => {
  it('flattens whitespace, cuts and quotes', () => {
    expect(quoteAiText('  a \n b  ', 10)).toBe('“a b”');
    expect(quoteAiText('abcdef', 3)).toBe('“abc…”');
  });
});
