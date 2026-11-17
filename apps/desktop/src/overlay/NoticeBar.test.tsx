import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NoticeBar } from './NoticeBar';

const warning = { id: 'a', tone: 'warning', text: 'Còn khoảng 8 phút dịch tháng này' } as const;
const error = { id: 'b', tone: 'error', text: 'Đã hết giờ dịch tháng này' } as const;

describe('NoticeBar', () => {
  it('renders nothing without notices', () => {
    expect(renderToStaticMarkup(<NoticeBar notices={[]} onDismiss={vi.fn()} />)).toBe('');
  });

  it('puts every message on a solid card with a tone border, not tone-coloured text', () => {
    const markup = renderToStaticMarkup(
      <NoticeBar notices={[warning, error]} onDismiss={vi.fn()} />,
    );
    expect(markup).toContain('bg-card');
    expect(markup).toContain('border-warning');
    expect(markup).toContain('border-destructive');
    expect(markup).not.toContain('bg-destructive/10');
    expect(markup).toContain(warning.text);
    expect(markup).toContain(error.text);
  });

  it('announces errors as alerts and warnings as status, each dismissible', () => {
    const markup = renderToStaticMarkup(
      <NoticeBar notices={[warning, error]} onDismiss={vi.fn()} />,
    );
    expect(markup).toContain('role="status"');
    expect(markup).toContain('role="alert"');
    expect(markup.match(/aria-label="Đóng thông báo"/g)).toHaveLength(2);
  });

  it('shows one fixing action only for notices that have one', () => {
    const markup = renderToStaticMarkup(
      <NoticeBar
        notices={[warning, error]}
        onDismiss={vi.fn()}
        actionFor={(notice) =>
          notice.tone === 'error' ? { label: 'Nâng cấp', onSelect: vi.fn() } : undefined
        }
      />,
    );
    expect(markup.match(/Nâng cấp/g)).toHaveLength(1);
  });
});
