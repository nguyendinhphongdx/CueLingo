import { DEFAULT_USER_SETTINGS } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PreferencesForm } from './Preferences';

const render = (overrides: Partial<Parameters<typeof PreferencesForm>[0]> = {}) =>
  renderToStaticMarkup(
    <PreferencesForm
      settings={DEFAULT_USER_SETTINGS}
      loading={false}
      saving={false}
      saved={false}
      error={null}
      onSave={async () => {}}
      onChange={() => {}}
      {...overrides}
    />,
  );

describe('PreferencesForm', () => {
  it('shows all account preferences with audio saving off by default (AC6)', () => {
    const markup = render();
    expect(markup).toContain('Mức hỗ trợ mặc định');
    expect(markup).toContain('Cỡ chữ overlay');
    expect(markup).toContain('Độ đậm nền overlay');
    expect(markup).toContain('Giao diện overlay');
    expect(markup).toContain('Lưu âm thanh để nghe lại đoạn khó');
    expect(markup).toContain('tối đa 30 ngày');
    expect(markup).toContain('type="checkbox"');
    expect(markup).not.toContain('checked=""');
  });

  it('shows saving, success and failure states (AC6)', () => {
    expect(render({ saving: true })).toContain('Đang lưu…');
    expect(render({ saved: true })).toContain('Đã lưu tuỳ chọn.');
    expect(render({ error: 'Không kết nối được tới máy chủ' })).toContain(
      'Không kết nối được tới máy chủ',
    );
  });
});
