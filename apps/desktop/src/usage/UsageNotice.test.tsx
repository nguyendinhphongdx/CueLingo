// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  openWeb: vi.fn(),
  billing: { enabled: false, offers: [] } as unknown,
}));
vi.mock('../app/open-web', () => ({ openWeb: mocks.openWeb }));
vi.mock('./billing-api', () => ({ billingApi: { overview: async () => mocks.billing } }));
vi.mock('./usage-api', () => ({
  usageApi: {
    get: async () => {
      const resetsAt = '2026-11-30T17:00:00.000Z';
      const other = { used: 0, limit: null, resetsAt, state: 'ok' };
      return {
        plan: 'free',
        usage: {
          translation_ms: { used: 10, limit: 10, resetsAt, state: 'exhausted' },
          cloud_stt_ms: other,
          debriefs: other,
          assist_daily: other,
          agent_messages: other,
        },
      };
    },
  },
}));

import { UsageNotice } from './UsageNotice';

let cleanup = () => {};
afterEach(() => cleanup());

async function render() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <UsageNotice />
      </QueryClientProvider>,
    );
  });
  // Let both queries settle.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  cleanup = () => {
    act(() => root.unmount());
    host.remove();
  };
  return host;
}

describe('UsageNotice upgrade button', () => {
  it('is hidden when payments are off, though the allowance is used up', async () => {
    mocks.billing = { enabled: false, offers: [] };
    const host = await render();
    expect(host.textContent).toContain('Hết giờ dịch tháng này');
    expect(host.textContent).not.toContain('Nâng cấp');
  });

  it('is shown and opens the web upgrade page when payments are on', async () => {
    mocks.billing = { enabled: true, offers: [{}] };
    const host = await render();
    const button = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Nâng cấp');
    expect(button).toBeDefined();
    act(() => button!.click());
    expect(mocks.openWeb).toHaveBeenCalledWith('/upgrade');
  });
});
