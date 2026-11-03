import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from './language-switcher';

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  // Lets the component function be called outside a render.
  useId: () => 'id',
}));

const noop = () => {};

/** The first element of a type in a returned tree. */
function findByType(node: ReactNode, type: string): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement(node)) return null;
  const element = node as ReactElement<Record<string, unknown>>;
  if (element.type === type) return element;
  for (const child of Children.toArray(element.props.children as ReactNode)) {
    const found = findByType(child, type);
    if (found) return found;
  }
  return null;
}

const both = [
  { value: 'en', label: 'Tiếng Anh' },
  { value: 'ja', label: 'Tiếng Nhật' },
] as const;

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
    expect(markup).toMatch(/<label[^>]*for="([^"]+)"[^>]*>Ngôn ngữ<\/label>/);
    expect(markup).toContain('<select');
    expect(markup).toContain('>Tiếng Anh</option>');
    expect(markup).toMatch(/<option value="ja" selected="">Tiếng Nhật<\/option>/);
    expect(markup).not.toMatch(/<select[^>]* disabled=""/);
  });

  it('renders nothing for no options and can be disabled', () => {
    expect(
      renderToStaticMarkup(
        <LanguageSwitcher options={[]} value={'en' as string} onChange={noop} />,
      ),
    ).toBe('');
    const markup = renderToStaticMarkup(
      <LanguageSwitcher
        options={[
          { value: 'en', label: 'Tiếng Anh' },
          { value: 'ja', label: 'Tiếng Nhật' },
        ]}
        value="en"
        onChange={noop}
        disabled
      />,
    );
    expect(markup).toMatch(/<select[^>]* disabled=""/);
  });

  it('passes the typed value of the chosen option to onChange', () => {
    const chosen: string[] = [];
    const tree = LanguageSwitcher({
      options: [...both],
      value: 'en',
      onChange: (value) => chosen.push(value),
    });
    const select = findByType(tree, 'select');
    const onChange = select?.props.onChange as (event: { target: { value: string } }) => void;
    onChange({ target: { value: 'ja' } });
    onChange({ target: { value: 'unknown' } });
    expect(chosen).toEqual(['ja']);
  });

  it('hands the disabled flag to the select', () => {
    const tree = LanguageSwitcher({
      options: [...both],
      value: 'en',
      onChange: noop,
      disabled: true,
    });
    expect(findByType(tree, 'select')?.props.disabled).toBe(true);
  });
});
