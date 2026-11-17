// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVED_SHOWN_MS, SAVED_TEXT, SavedIndicator, useSavedFlash } from './SavedIndicator';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SavedIndicator', () => {
  it('keeps an empty polite live region until something is saved', () => {
    const idle = renderToStaticMarkup(<SavedIndicator saved={false} />);
    expect(idle).toContain('aria-live="polite"');
    expect(idle).toContain('role="status"');
    expect(idle).not.toContain(SAVED_TEXT);
    expect(renderToStaticMarkup(<SavedIndicator saved />)).toContain(SAVED_TEXT);
  });
});

describe('useSavedFlash', () => {
  let host: HTMLElement;
  let root: Root;
  let flash: ReturnType<typeof useSavedFlash>;
  function Probe() {
    flash = useSavedFlash();
    return null;
  }
  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement('div');
    root = createRoot(host);
    act(() => root.render(<Probe />));
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it('shows after a save and fades after the delay', () => {
    expect(flash.saved).toBe(false);
    act(() => flash.markSaved());
    expect(flash.saved).toBe(true);
    act(() => void vi.advanceTimersByTime(SAVED_SHOWN_MS - 1));
    expect(flash.saved).toBe(true);
    act(() => void vi.advanceTimersByTime(2));
    expect(flash.saved).toBe(false);
  });

  it('restarts the wait on a second save and hides on reset', () => {
    act(() => flash.markSaved());
    act(() => void vi.advanceTimersByTime(SAVED_SHOWN_MS - 100));
    act(() => flash.markSaved());
    act(() => void vi.advanceTimersByTime(SAVED_SHOWN_MS - 100));
    expect(flash.saved).toBe(true);
    act(() => flash.reset());
    expect(flash.saved).toBe(false);
  });
});
