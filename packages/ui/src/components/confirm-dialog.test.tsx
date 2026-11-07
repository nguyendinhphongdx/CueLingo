import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

const noop = () => {};
const render = (open: boolean) =>
  renderToStaticMarkup(
    <ConfirmDialog
      open={open}
      title="Tiêu đề"
      confirmLabel="Đồng ý"
      cancelLabel="Huỷ"
      onConfirm={noop}
      onCancel={noop}
    >
      Nội dung
    </ConfirmDialog>,
  );

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    expect(render(false)).toBe('');
  });

  it('shows the message and both choices when open', () => {
    const markup = render(true);
    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain('Nội dung');
    expect(markup).toContain('Đồng ý');
    expect(markup).toContain('Huỷ');
  });

  it('can start on the cancel button with the confirm button disabled for a moment', () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="t"
        confirmLabel="Đồng ý"
        cancelLabel="Huỷ"
        initialFocus="cancel"
        confirmDelayMs={600}
        onConfirm={noop}
        onCancel={noop}
      >
        x
      </ConfirmDialog>,
    );
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Đồng ý/);
    expect(markup).not.toContain('autofocus');
    // The default stays as before: confirm is focused and enabled.
    expect(render(true)).not.toContain('disabled=""');
    expect(render(true)).toContain('autofocus=""');
  });
});
