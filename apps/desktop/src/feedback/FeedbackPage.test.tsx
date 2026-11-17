import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn() }));

import { APP_VERSION } from '../app/brand';
import { FEEDBACK_NOTE, FeedbackPage } from './FeedbackPage';

describe('FeedbackPage', () => {
  it('says what is sent, with the app version, and keeps the shared form', () => {
    const markup = renderToStaticMarkup(<FeedbackPage />);
    expect(FEEDBACK_NOTE).toContain(APP_VERSION);
    expect(markup).toContain('Chỉ gửi nội dung bạn viết và phiên bản app');
    expect(markup).toContain('Không gửi caption hay âm thanh.');
    expect(markup).toContain('Báo lỗi');
    expect(markup).toContain('Gửi');
  });
});
