import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DownloadPage } from './download-page';
import { LandingView } from './landing-view';

const landing = () => renderToStaticMarkup(<LandingView />);

describe('landing page structure', () => {
  it('has one h1 and a heading on every section', () => {
    const markup = landing();
    expect(markup.match(/<h1/g)).toHaveLength(1);
    const sections = markup.match(/<section[^>]*>/g) ?? [];
    expect(sections.length).toBeGreaterThanOrEqual(5);
    for (const section of sections) expect(section).toContain('aria-labelledby');
  });

  it('shows the product itself in the first screen: a captioned fragment, not a colour block', () => {
    const markup = landing();
    expect(markup).toContain('Let&#x27;s align on the launch plan before Friday.');
    expect(markup).toContain('data-ui');
  });

  it('says what the product does, what it keeps on the Mac, and answers real questions', () => {
    const markup = landing();
    expect(markup).toContain('Tiếng Anh ở lại trên máy');
    expect(markup).toContain('Dữ liệu cuộc họp của tôi đi đâu?');
    expect(markup).toContain('Câu hỏi thường gặp');
    expect(markup).toContain('macOS 14.2');
  });

  it('draws the stage slider as a labelled range and one button per stage', () => {
    const markup = landing();
    expect(markup).toContain('type="range"');
    expect(markup).toContain('aria-label="Chọn giai đoạn của cuộc họp"');
    for (const name of ['Nghe', 'Hiểu', 'Hỏi', 'Nhớ']) expect(markup).toContain(`>${name}<`);
  });
});

describe('no invented proof', () => {
  const forbidden = [
    /khách hàng/i,
    /tin dùng/i,
    /đánh giá/i,
    /\u2605/,
    /\d+\s?%/,
    /\d[\d.,]*\s?(người dùng|công ty|doanh nghiệp|khách)/i,
    /được .* tin/i,
  ];

  it.each([
    ['landing', landing],
    ['download', () => renderToStaticMarkup(<DownloadPage downloadUrl={null} />)],
  ])('%s carries no customer claims, ratings or statistics', (_name, render) => {
    const text = render().replace(/<[^>]+>/g, ' ');
    for (const pattern of forbidden) expect(text).not.toMatch(pattern);
  });
});
