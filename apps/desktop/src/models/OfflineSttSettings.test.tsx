import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OfflineSttSettingsView } from './OfflineSttSettings';
import type { ModelView } from './model-state';

const html = (on: boolean, view: ModelView) =>
  renderToStaticMarkup(
    <OfflineSttSettingsView on={on} view={view} onToggle={() => {}} onDownload={() => {}} />,
  );
const missing: ModelView = { kind: 'missing', sizeBytes: 77_000_000 };

describe('offline fallback settings', () => {
  it('explains the trade-off and offers to turn it on, without a download yet', () => {
    const out = html(false, missing);
    expect(out).toContain('không gửi âm thanh đi');
    expect(out).toContain('chất lượng thấp hơn');
    expect(out).toContain('Bật dự phòng');
    expect(out).toContain('aria-pressed="false"');
    expect(out).not.toContain('Tải mô hình ngay');
  });

  it('shows the download when it is on and the model is missing', () => {
    const out = html(true, missing);
    expect(out).toContain('Tắt dự phòng');
    expect(out).toContain('Tải mô hình ngay');
    expect(out).toContain('73 MB');
  });

  it('shows progress while the model downloads', () => {
    const out = html(true, { kind: 'downloading', sizeBytes: 77_000_000, progress: 0.5 });
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('50%');
  });

  it('shows the model ready', () => {
    expect(html(true, { kind: 'ready', sizeBytes: 77_000_000 })).toContain('Đã sẵn sàng');
  });
});
