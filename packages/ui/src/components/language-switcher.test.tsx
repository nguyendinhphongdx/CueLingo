import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LanguageSwitcher } from './language-switcher';

const noop = () => {};

describe('LanguageSwitcher', () => {
  it('renders nothing while only one language is available', () => {
    const markup = renderToStaticMarkup(
      <LanguageSwitcher
        options={[{ value: 'en', label: 'Tiếng Anh' }]}
        value="en"
        onChange={noop}
      />,
    );
    expect(markup).toBe('');
  });

  it('offers every language and marks the chosen one', () => {
    const markup = renderToStaticMarkup(
      <LanguageSwitcher
        options={[
          { value: 'en', label: 'Tiếng Anh' },
          { value: 'ja', label: 'Tiếng Nhật' },
        ]}
        value="ja"
        onChange={noop}
      />,
    );
    expect(markup).toContain('aria-label="Ngôn ngữ"');
    expect(markup).toContain('Tiếng Nhật');
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Tiếng Nhật/);
  });
});
