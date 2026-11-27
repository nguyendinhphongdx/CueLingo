// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { TranscriptEvent } from '../lib/native';
import { CaptionOverlay } from './CaptionOverlay';

vi.mock('../quick-assist/meeting-assist-api', () => ({
  meetingAssistApi: { status: async () => ({ enabled: true, consent: true }) },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const segment: TranscriptEvent = {
  segmentId: 'real-1',
  text: 'Original sentence',
  translation: 'Câu dịch',
  partial: false,
};

/** Only the assistant's drawer has this suggestion. */
const ASSISTANT = 'Giải thích câu cuối';
const host = document.createElement('div');

async function click(selector: string, text = '') {
  const found = [...host.querySelectorAll<HTMLElement>(selector)].find((element) =>
    element.textContent?.includes(text),
  );
  expect(found, `${selector} ${text}`).toBeDefined();
  await act(async () => found!.click());
}

async function choose(tool: string) {
  await click('[aria-label="Công cụ hỗ trợ"]');
  await click('[role="menuitem"]', tool);
}

/**
 * The drawer slides in over a few frames, and React only applies what happened when each `act` ends, so
 * this waits in short steps until the check holds.
 */
async function until(check: () => void) {
  for (let round = 0; ; round += 1) {
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
    try {
      return check();
    } catch (error) {
      if (round === 80) throw error;
    }
  }
}

describe('the drawer shared by the assistant and the other tools (AC1)', () => {
  it('shows the one opened last while captions go on', async () => {
    const root = createRoot(host);
    await act(async () =>
      root.render(<CaptionOverlay listen={false} segments={[segment]} receivedTranscript />),
    );

    await choose('Hỏi trợ lý');
    await until(() => expect(host.textContent).toContain(ASSISTANT));
    expect(host.textContent).toContain('Câu dịch');

    await choose('Nói giúp');
    await until(() => expect(host.textContent).not.toContain(ASSISTANT));

    await choose('Hỏi trợ lý');
    await until(() => expect(host.textContent).toContain(ASSISTANT));
    expect(host.textContent).toContain('Câu dịch');

    await act(async () => root.unmount());
  });
});
