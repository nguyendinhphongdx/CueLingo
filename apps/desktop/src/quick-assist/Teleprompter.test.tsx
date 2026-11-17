import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Teleprompter } from './Teleprompter';

describe('Teleprompter', () => {
  const markup = renderToStaticMarkup(
    <Teleprompter
      text="Yes, I can. Let me confirm the details."
      note="Được, để mình xác nhận chi tiết."
      onBack={vi.fn()}
      onCopy={vi.fn(async () => undefined)}
    />,
  );

  it('shows the sentence in large type with its Vietnamese note', () => {
    expect(markup).toContain('Yes, I can. Let me confirm the details.');
    expect(markup).toContain('Được, để mình xác nhận chi tiết.');
    expect(markup).toContain('text-5xl');
    expect(markup).toContain('bg-background');
  });

  it('offers listen, copy, back and three text sizes', () => {
    expect(markup).toContain('Nghe');
    expect(markup).toContain('Sao chép');
    expect(markup).toContain('Quay lại các lựa chọn');
    expect(markup).toContain('aria-label="Cỡ chữ"');
    expect(markup.match(/aria-pressed/g)).toHaveLength(3);
  });
});
