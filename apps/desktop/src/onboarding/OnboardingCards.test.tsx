// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth', () => ({ useMe: () => ({ me: { id: 'cards-user' } }) }));

import { OnboardingCards, OnboardingCardsView } from './OnboardingCards';
import { pendingSteps, progressKey, readProgress } from './onboarding-storage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => {};

describe('OnboardingCardsView', () => {
  it('shows one card per open step, each with a way back in', () => {
    const markup = renderToStaticMarkup(
      <OnboardingCardsView steps={[2, 4]} onResume={noop} onHide={noop} />,
    );
    expect(markup).toContain('Chưa xong: Mô hình');
    expect(markup).toContain('Chưa xong: Bài nghe');
    expect(markup.match(/Làm ngay/g)).toHaveLength(2);
  });

  it('folds many open steps into one card that says how many are left', () => {
    const markup = renderToStaticMarkup(
      <OnboardingCardsView steps={[1, 2, 3, 4, 5]} onResume={noop} onHide={noop} />,
    );
    expect(markup).toContain('Còn 5 bước để làm quen');
    expect(markup.match(/Làm ngay/g)).toHaveLength(1);
    expect(markup).not.toContain('Chưa xong:');
  });

  it('shows nothing when everything is done', () => {
    expect(
      renderToStaticMarkup(<OnboardingCardsView steps={[]} onResume={noop} onHide={noop} />),
    ).toBe('');
  });
});

describe('OnboardingCards', () => {
  let host: HTMLElement;
  let root: Root;
  beforeEach(() => {
    localStorage.clear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });
  const button = (label: string) =>
    [...host.querySelectorAll('button')].find((b) => b.textContent === label) as HTMLButtonElement;

  function save(done: number[]) {
    localStorage.setItem(progressKey('cards-user'), JSON.stringify({ step: 1, done }));
  }

  it('Làm ngay opens the step of the card', () => {
    save([1, 3, 4, 5]);
    const onResume = vi.fn();
    act(() => root.render(<OnboardingCards onResume={onResume} />));
    expect(host.textContent).toContain('Chưa xong: Mô hình');
    act(() => button('Làm ngay').click());
    expect(onResume).toHaveBeenCalledWith(2);
  });

  it('Ẩn marks the step done, saves it and removes the card', () => {
    save([1, 3, 4, 5]);
    act(() => root.render(<OnboardingCards onResume={noop} />));
    act(() => button('Ẩn').click());
    expect(host.textContent).toBe('');
    expect(pendingSteps(readProgress('cards-user'))).toEqual([]);
  });

  it('Ẩn on the folded card marks every open step done', () => {
    save([]);
    act(() => root.render(<OnboardingCards onResume={noop} />));
    expect(host.textContent).toContain('Còn 5 bước');
    act(() => button('Ẩn').click());
    expect(host.textContent).toBe('');
    expect(pendingSteps(readProgress('cards-user'))).toEqual([]);
  });
});
