import type { AdminAgentStatus } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AdminAgentView, pluginStateLabel } from './AdminAgentPage';

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

const plugin = (over: Partial<AdminAgentStatus['plugins'][number]>) => ({
  id: 'core',
  version: '1.0.0',
  state: 'loaded' as const,
  permissions: ['phrases:read' as const],
  tools: ['lookup_word', 'save_phrase'],
  ...over,
});
const status = (over: Partial<AdminAgentStatus> = {}): AdminAgentStatus => ({
  enabled: true,
  available: true,
  plugins: [plugin({})],
  ...over,
});
const render = (value: AdminAgentStatus, saving = false) =>
  renderToStaticMarkup(
    <AdminAgentView
      status={value}
      saving={saving}
      onToggleAll={() => {}}
      onTogglePlugin={() => {}}
    />,
  );

describe('admin agent view', () => {
  it('shows the switch, the plugin with its tools and permissions, and a button to turn it off', () => {
    const markup = render(status());
    expect(markup).toContain('Tắt trợ lý');
    expect(markup).toContain('core');
    expect(markup).toContain('lookup_word, save_phrase');
    expect(markup).toContain('phrases:read');
    expect(markup).toContain('Đang bật');
    expect(markup).toMatch(/Tắt<span class="sr-only"> plugin core/);
  });

  it('offers to turn the assistant and a disabled plugin back on', () => {
    const markup = render(
      status({ enabled: false, plugins: [plugin({ state: 'disabled', disabledBy: 'admin' })] }),
    );
    expect(markup).toContain('Bật trợ lý');
    expect(markup).toContain('Đã tắt bởi admin');
    expect(markup).toMatch(/Bật<span class="sr-only"> plugin core/);
  });

  it('explains a breaker pause and gives no toggle for a plugin that failed to load', () => {
    expect(
      pluginStateLabel(
        plugin({ state: 'disabled', disabledBy: 'breaker', retryAt: '2026-11-06T10:00:00.000Z' }),
      ),
    ).toContain('Tự tắt do lỗi liên tiếp, thử lại lúc');
    const markup = render(status({ plugins: [plugin({ id: 'bad', state: 'failed' })] }));
    expect(markup).toContain('Lỗi khi nạp');
    expect(markup).not.toContain('plugin bad');
  });

  it('says the switch has no effect when the deploy has the assistant off, and disables buttons while saving', () => {
    expect(render(status({ available: false }))).toContain('chưa có tác dụng');
    expect(render(status(), true)).toContain('disabled');
  });

  it('renders no user data fields', () => {
    expect(render(status())).not.toMatch(/email|userId/i);
  });
});
