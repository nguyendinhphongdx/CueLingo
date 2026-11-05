import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WordActionsMenu, type WordActionsMenuProps } from './word-actions-menu';

const noop = () => {};
const render = (props: Partial<WordActionsMenuProps> = {}) =>
  renderToStaticMarkup(
    <WordActionsMenu
      word="circle back"
      position={{ x: 10, y: 20 }}
      saved={false}
      lookup={{ status: 'idle' }}
      onLookup={noop}
      onSpeak={noop}
      onSave={noop}
      onClose={noop}
      {...props}
    />,
  );

describe('WordActionsMenu', () => {
  it('is a menu with the three actions, named after the word', () => {
    const out = render();
    expect(out).toContain('role="menu"');
    expect(out).toContain('circle back');
    expect(out.match(/role="menuitem"/g)).toHaveLength(3);
    expect(out).toContain('Tra nghĩa');
    expect(out).toContain('Nghe');
    expect(out).toContain('Lưu');
    expect(out).not.toContain('Đã lưu');
  });

  it('shows Đã lưu and marks the action unavailable when the word is saved', () => {
    const out = render({ saved: true });
    expect(out).toContain('Đã lưu');
    expect(out).toContain('aria-disabled="true"');
  });

  it('shows the lookup result and a friendly error', () => {
    const done = render({
      lookup: {
        status: 'done',
        meaningVi: 'quay lại sau',
        pos: 'phrasal verb',
        exampleEn: 'Let us circle back.',
      },
    });
    expect(done).toContain('quay lại sau');
    expect(done).toContain('Let us circle back.');
    expect(render({ lookup: { status: 'error' } })).toContain('Chưa tra được từ này');
  });
});
