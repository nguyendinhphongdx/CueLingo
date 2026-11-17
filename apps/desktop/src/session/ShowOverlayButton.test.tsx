// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({ showOverlay: vi.fn() }));
vi.mock('../lib/native', () => ({ native: { showOverlay: h.showOverlay } }));

import { ShowOverlayButton } from './ShowOverlayButton';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  h.showOverlay.mockReset();
  h.showOverlay.mockResolvedValue(undefined);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<ShowOverlayButton />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('ShowOverlayButton', () => {
  it('is a plainly labelled button in the main window', () => {
    const button = host.querySelector('button');
    expect(button?.textContent).toContain('Hiện overlay');
  });

  it('asks the native side to show the overlay when pressed', async () => {
    await act(async () => host.querySelector('button')?.click());
    expect(h.showOverlay).toHaveBeenCalledTimes(1);
  });

  it('does not break the page when the native side refuses', async () => {
    h.showOverlay.mockRejectedValue(new Error('no overlay'));
    await act(async () => host.querySelector('button')?.click());
    expect(h.showOverlay).toHaveBeenCalledTimes(1);
  });
});
