import type { GlossaryTerm } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlossaryView } from './GlossaryPage';

const item: GlossaryTerm = {
  id: '11111111-1111-4111-8111-111111111111',
  term: 'Product discovery',
  translation: 'Khám phá sản phẩm',
  note: 'Dùng trong planning',
  createdAt: '2026-11-01T00:00:00.000Z',
};

const props = {
  items: [item],
  loading: false,
  saving: false,
  error: null,
  onAdd: async () => true,
  onUpdate: async () => true,
  onRemove: async () => true,
  onRetry: async () => {},
};

describe('GlossaryView', () => {
  it('shows add fields, search and term actions', () => {
    const markup = renderToStaticMarkup(<GlossaryView {...props} />);

    expect(markup).toContain('Caption sẽ nghe và dịch đúng các từ này');
    expect(markup).toContain('Nghĩa tiếng Việt');
    expect(markup).toContain('Ghi chú');
    expect(markup).toContain('aria-label="Tìm thuật ngữ"');
    expect(markup).toContain('aria-label="Sửa Product discovery"');
    expect(markup).toContain('aria-label="Xoá Product discovery"');
  });

  it('renders inline editing and explicit delete confirmation states', () => {
    const editing = renderToStaticMarkup(<GlossaryView {...props} initialEditingId={item.id} />);
    const deleting = renderToStaticMarkup(<GlossaryView {...props} initialDeletingId={item.id} />);

    expect(editing).toContain('Lưu thay đổi');
    expect(editing).toContain(`id="term-${item.id}"`);
    expect(deleting).toContain('Xoá thuật ngữ này?');
    expect(deleting).toContain('Giữ lại');
  });

  it('shows duplicate errors and an actionable empty state', () => {
    const duplicate = renderToStaticMarkup(
      <GlossaryView {...props} error="Thuật ngữ này đã có trong danh sách" />,
    );
    const empty = renderToStaticMarkup(<GlossaryView {...props} items={[]} />);

    expect(duplicate).toContain('role="alert"');
    expect(duplicate).toContain('Thuật ngữ này đã có trong danh sách');
    expect(empty).toContain('Chưa có thuật ngữ nào');
  });
});
