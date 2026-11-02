import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ClickableCaptionLine, splitCaptionWords } from './ClickableCaptionLine';
import { QuickAssistPanel } from './QuickAssistPanel';
import type { QuickAssistActions, QuickAssistState } from './use-quick-assist';
import { listenForQuickAssistHotkeys } from './use-quick-assist';

function actions(): QuickAssistActions {
  return {
    state: { view: 'closed' },
    lookup: vi.fn(),
    retryLookup: vi.fn(),
    openRecap: vi.fn(),
    retryRecap: vi.fn(),
    openCompose: vi.fn(),
    setComposeIntent: vi.fn(),
    submitCompose: vi.fn(),
    retryCompose: vi.fn(),
    selectOption: vi.fn(),
    copyOption: vi.fn(),
    close: vi.fn(),
  };
}

function renderPanel(state: QuickAssistState) {
  return renderToStaticMarkup(<QuickAssistPanel state={state} actions={actions()} />);
}

describe('Quick Assist UI', () => {
  it('renders each English word as a lookup target with its sentence retained by the caller', () => {
    const markup = renderToStaticMarkup(
      <ClickableCaptionLine
        text="Let's review the plan."
        translation="Hãy xem lại kế hoạch."
        onLookup={vi.fn()}
      />,
    );

    expect(splitCaptionWords("Let's review.")).toEqual(["Let's", ' ', 'review', '.']);
    expect(markup).toContain('aria-label="Tra từ review"');
    expect(markup).toContain('min-h-11');
  });

  it('shows lookup loading, result, and Vietnamese retry error states', () => {
    const loading = renderPanel({
      view: 'lookup',
      status: 'loading',
      term: 'review',
      context: 'Let us review.',
    });
    const result = renderPanel({
      view: 'lookup',
      status: 'success',
      term: 'review',
      context: 'Let us review.',
      result: {
        term: 'review',
        meaningVi: 'xem lại',
        exampleEn: 'Let us review the plan.',
        noteVi: 'Dùng trong cuộc họp.',
      },
    });
    const error = renderPanel({
      view: 'lookup',
      status: 'error',
      term: 'review',
      context: 'Let us review.',
    });

    expect(loading).toContain('Đang tra nghĩa…');
    expect(result).toContain('xem lại');
    expect(result).toContain('Dùng trong cuộc họp.');
    expect(error).toContain('Không thể tra từ lúc này');
    expect(error).toContain('Thử lại');
  });

  it('opens recap and compose from native hotkey events', async () => {
    let listener: ((event: { action: 'recap' | 'say_for_me' }) => void) | undefined;
    const callback = vi.fn();
    const source = {
      onHotkey: vi.fn(async (next: typeof listener) => {
        listener = next;
        return vi.fn();
      }),
    };

    await listenForQuickAssistHotkeys(callback, source);
    listener?.({ action: 'recap' });
    listener?.({ action: 'say_for_me' });

    expect(callback).toHaveBeenNthCalledWith(1, { action: 'recap' });
    expect(callback).toHaveBeenNthCalledWith(2, { action: 'say_for_me' });
  });

  it('renders recap content and a compose form with readable options in a right-hand drawer', () => {
    const recap = renderPanel({
      view: 'recap',
      status: 'success',
      result: { summaryVi: 'Nhóm đã chốt kế hoạch.', bulletsVi: ['Ra mắt vào thứ Hai.'] },
    });
    const compose = renderPanel({
      view: 'compose',
      status: 'success',
      intent: 'Tôi đồng ý',
      result: { options: [{ en: 'I agree with the plan.' }, { en: 'That works for me.' }] },
    });

    expect(recap).toContain('Nhóm đã chốt kế hoạch.');
    expect(compose).toContain('Ý muốn nói bằng tiếng Việt');
    expect(compose).toContain('text-base');
    expect(compose).toContain('border-l');
    expect(compose).toContain('I agree with the plan.');
  });

  it('splits Japanese captions into tappable words', () => {
    const parts = splitCaptionWords('来週の会議に参加します。', 'ja');
    expect(parts.join('')).toBe('来週の会議に参加します。');
    expect(parts.length).toBeGreaterThan(3);
  });
});
