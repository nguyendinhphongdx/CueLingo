import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SETTINGS_SECTIONS, SettingsNav } from './SettingsPage';

describe('Cài đặt', () => {
  it('lists the sections and marks the open one', () => {
    const markup = renderToStaticMarkup(
      <SettingsNav sections={SETTINGS_SECTIONS} active="privacy" onSelect={() => {}} />,
    );
    for (const label of ['Họp và caption', 'Giọng đọc', 'Quyền riêng tư', 'Thiết bị và máy chủ']) {
      expect(markup).toContain(label);
    }
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
