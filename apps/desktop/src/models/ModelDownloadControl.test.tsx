import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ModelDownloadControl } from './ModelDownloadControl';
import type { ModelView } from './model-state';

const html = (view: ModelView) =>
  renderToStaticMarkup(<ModelDownloadControl view={view} name="tiếng Anh" onDownload={() => {}} />);

describe('ModelDownloadControl', () => {
  it('offers the download with its size when the model is missing', () => {
    const out = html({ kind: 'missing', sizeBytes: 661_288_526 });
    expect(out).toContain('Tải mô hình ngay');
    expect(out).toContain('631 MB');
  });

  it('shows a progress bar and the percentage while downloading, with no button', () => {
    const out = html({ kind: 'downloading', sizeBytes: 661_288_526, progress: 0.42 });
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('aria-valuenow="42"');
    expect(out).toContain('42%');
    expect(out).not.toContain('<button');
  });

  it('says ready, with no download button', () => {
    const out = html({ kind: 'ready', sizeBytes: 1 });
    expect(out).toContain('Đã sẵn sàng');
    expect(out).not.toContain('<button');
  });

  it('says why a download failed and offers to try again', () => {
    const out = html({ kind: 'error', sizeBytes: 1, message: 'Không tải được mô hình.' });
    expect(out).toContain('role="alert"');
    expect(out).toContain('Không tải được mô hình.');
    expect(out).toContain('Thử lại');
  });

  it('needs nothing for a cloud language, and waits for the first answer', () => {
    expect(html({ kind: 'cloud' })).toContain('Không cần tải mô hình');
    expect(html({ kind: 'checking' })).toContain('Đang kiểm tra');
  });
});
