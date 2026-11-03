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
});
