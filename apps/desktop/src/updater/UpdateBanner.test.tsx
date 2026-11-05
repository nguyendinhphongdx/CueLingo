import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UpdateBannerView } from './UpdateBanner';

const noop = () => {};
const view = (state: Parameters<typeof UpdateBannerView>[0]['state'], locked = false) =>
  renderToStaticMarkup(
    <UpdateBannerView state={state} locked={locked} onInstall={noop} onDismiss={noop} />,
  );

describe('UpdateBanner', () => {
  it('renders nothing without an update', () => {
    expect(view({ phase: 'none' })).toBe('');
  });

  it('warns that permissions may be asked again and lets the person update', () => {
    const markup = view({ phase: 'available', version: '0.2.0', notes: null });
    expect(markup).toContain('0.2.0');
    expect(markup).toContain('quyền micro');
    expect(markup).not.toContain('disabled=""');
  });

  it('locks the button during a meeting', () => {
    const markup = view({ phase: 'available', version: '0.2.0', notes: null }, true);
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('sau khi họp xong');
  });

  it('explains a signature mismatch', () => {
    const markup = view({ phase: 'failed', version: '0.2.0', reason: 'signature' });
    expect(markup).toContain('chữ ký');
  });
});
