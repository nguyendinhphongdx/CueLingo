import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_ERROR_TEXT,
  FEEDBACK_PRIVACY_NOTE,
  FEEDBACK_SENT_TEXT,
  FeedbackFormView,
  type FeedbackFormViewProps,
} from './feedback-form';

const noop = () => {};
const view = (overrides: Partial<FeedbackFormViewProps> = {}) =>
  renderToStaticMarkup(
    <FeedbackFormView
      kind="bug"
      message=""
      sending={false}
      sent={false}
      failed={false}
      onKind={noop}
      onMessage={noop}
      onSubmit={noop}
      {...overrides}
    />,
  );

describe('FeedbackForm (AC6)', () => {
  it('offers bug, idea and other, a counter out of 2000 and says nothing private is attached', () => {
    const markup = view({ message: 'abc' });
    expect(markup).toContain('Báo lỗi');
    expect(markup).toContain('Góp ý');
    expect(markup).toContain('Khác');
    expect(markup).toContain('3/2000');
    expect(markup).toContain(FEEDBACK_PRIVACY_NOTE);
    expect(markup).toContain('maxLength="2000"');
  });

  it('shows the note a client supplies instead of the default one', () => {
    const markup = view({ note: 'Chỉ gửi nội dung bạn viết và phiên bản app (0.1.5).' });
    expect(markup).toContain('phiên bản app (0.1.5)');
    expect(markup).not.toContain(FEEDBACK_PRIVACY_NOTE);
  });

  it('cannot be sent empty, and is locked while sending', () => {
    expect(view()).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
    expect(view({ message: 'ok' })).not.toMatch(/<button[^>]*type="submit"[^>]*disabled/);
    const sending = view({ message: 'ok', sending: true });
    expect(sending).toContain('Đang gửi…');
    expect(sending).toMatch(/<textarea[^>]*disabled/);
  });

  it('thanks the person after sending and says so when it failed', () => {
    expect(view({ sent: true })).toContain(FEEDBACK_SENT_TEXT);
    expect(view({ failed: true })).toContain(FEEDBACK_ERROR_TEXT);
  });
});
