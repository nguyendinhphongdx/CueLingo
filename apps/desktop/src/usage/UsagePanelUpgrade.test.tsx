// @vitest-environment jsdom
import type { UsageResponse } from '@cuelingo/shared';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { UsagePanelView } from './UsagePanelView';

const resetsAt = '2026-11-30T17:00:00.000Z';
const entry = { used: 0, limit: null, resetsAt, state: 'ok' as const };
const usage: UsageResponse = {
  plan: 'free',
  usage: {
    translation_ms: entry,
    cloud_stt_ms: entry,
    debriefs: entry,
    assist_daily: entry,
    agent_messages: entry,
    lessons_daily: entry,
    lesson_practice_daily: entry,
    meeting_ask_daily: entry,
  },
};

describe('UsagePanelView upgrade button', () => {
  it('calls onUpgrade once when "Nâng gói" is clicked', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onUpgrade = vi.fn();
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <UsagePanelView usage={usage} loading={false} error={null} onUpgrade={onUpgrade} />,
      );
    });
    const button = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Nâng gói');
    expect(button).toBeDefined();
    await act(async () => button!.click());
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });
});
