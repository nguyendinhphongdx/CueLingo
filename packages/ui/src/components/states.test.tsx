import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';
import { NoticeStrip } from './notice-strip';
import { StatusRow } from './status-row';

describe('StatusRow', () => {
  it('shows the fix only when not ok', () => {
    const bad = renderToStaticMarkup(
      <StatusRow status="error" title="Micro" action={<button>Sửa</button>} />,
    );
    const ok = renderToStaticMarkup(
      <StatusRow status="ok" title="Micro" action={<button>Sửa</button>} />,
    );
    expect(bad).toContain('Sửa');
    expect(ok).not.toContain('Sửa');
  });
});

describe('NoticeStrip', () => {
  it('is an alert for errors and a status otherwise', () => {
    expect(renderToStaticMarkup(<NoticeStrip tone="error">x</NoticeStrip>)).toContain(
      'role="alert"',
    );
    expect(renderToStaticMarkup(<NoticeStrip tone="warning">x</NoticeStrip>)).toContain(
      'role="status"',
    );
  });
});

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    const html = renderToStaticMarkup(
      <EmptyState title="Chưa có" description="Mô tả" action={<b>Đi</b>} />,
    );
    expect(html).toContain('Chưa có');
    expect(html).toContain('Đi');
  });
});
