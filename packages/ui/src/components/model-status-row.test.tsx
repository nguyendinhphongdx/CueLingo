import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ModelStatusRow, modelStatusText } from './model-status-row';

describe('modelStatusText', () => {
  it('says what each state means in Vietnamese', () => {
    expect(modelStatusText('missing', 0, 'khoảng 600 MB')).toBe(
      'Chưa tải về máy. Dung lượng khoảng 600 MB.',
    );
    expect(modelStatusText('downloading', 0.426)).toBe('Đang tải mô hình… 43%');
    expect(modelStatusText('downloading', 3)).toBe('Đang tải mô hình… 100%');
    expect(modelStatusText('compiling')).toContain('Đang chuẩn bị');
    expect(modelStatusText('ready')).toBe('Mô hình đã sẵn sàng.');
    expect(modelStatusText('cloud')).toContain('đám mây');
  });
});

describe('ModelStatusRow', () => {
  it('shows a progress bar while downloading and no action', () => {
    const html = renderToStaticMarkup(
      <ModelStatusRow
        title="Nhận dạng tiếng Anh"
        state="downloading"
        progress={0.5}
        actionLabel="Tải về"
        onAction={() => undefined}
      />,
    );
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).not.toContain('Tải về');
  });

  it('offers its action when missing, and the retry text on error', () => {
    const missing = renderToStaticMarkup(
      <ModelStatusRow
        title="m"
        state="missing"
        sizeLabel="khoảng 600 MB"
        actionLabel="Tải về"
        onAction={() => undefined}
      />,
    );
    expect(missing).toContain('Tải về');
    expect(missing).toContain('khoảng 600 MB');
    const failed = renderToStaticMarkup(
      <ModelStatusRow
        title="m"
        state="error"
        errorText="Kiểm tra mạng rồi thử lại."
        actionLabel="Thử lại"
        onAction={() => undefined}
      />,
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('Kiểm tra mạng rồi thử lại.');
    expect(failed).toContain('Thử lại');
  });

  it('shows no action when ready or when the language needs no model', () => {
    for (const state of ['ready', 'cloud'] as const) {
      const html = renderToStaticMarkup(
        <ModelStatusRow title="m" state={state} actionLabel="Tải lại" onAction={() => undefined} />,
      );
      expect(html).not.toContain('Tải lại');
    }
  });
});
