import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './button';
import { Card } from './card';
import { FilterCard } from './filter-card';
import { Input } from './input';
import { Kbd } from './kbd';
import { Logo, LogoLockup } from './logo';

describe('UI primitives', () => {
  it('renders Button as a button and accepts className', () => {
    const markup = renderToStaticMarkup(<Button className="custom-button">Lưu</Button>);

    expect(markup).toMatch(/^<button/);
    expect(markup).toContain('custom-button');
  });

  it('renders Input as an input and accepts className', () => {
    const markup = renderToStaticMarkup(<Input className="custom-input" aria-label="Cụm từ" />);

    expect(markup).toMatch(/^<input/);
    expect(markup).toContain('custom-input');
  });

  it('renders Card as a div and accepts className', () => {
    const markup = renderToStaticMarkup(<Card className="custom-card">Nội dung</Card>);

    expect(markup).toMatch(/^<div/);
    expect(markup).toContain('custom-card');
  });
});

describe('Logo', () => {
  it('draws the CueLingo mark at the size asked, named for screen readers', () => {
    const markup = renderToStaticMarkup(<Logo size={48} className="mark" />);

    expect(markup).toContain('width="48"');
    expect(markup).toContain('height="48"');
    expect(markup).toContain('aria-label="CueLingo"');
    expect(markup).toContain('M167 169.1A64 64 0 1 1 167 86.9');
    expect(markup).toContain('class="mark"');
  });

  it('keeps the two caption lines in their own colours', () => {
    const markup = renderToStaticMarkup(<Logo />);

    expect(markup).toContain('#a5b4fc');
    expect(markup).toContain('#f59e0b');
    expect(markup).toContain('width="36"');
  });

  it('puts the word CueLingo beside the mark in the lockup', () => {
    const markup = renderToStaticMarkup(<LogoLockup size={32} />);

    expect(markup).toContain('<svg');
    expect(markup).toMatch(/>CueLingo<\/span>/);
  });
});

describe('FilterCard', () => {
  it('is a toggle button that reports whether its filter is on', () => {
    const on = renderToStaticMarkup(
      <FilterCard label="Đang dùng Pro" value={12} selected onSelect={() => {}} />,
    );
    const off = renderToStaticMarkup(
      <FilterCard label="Đang dùng Pro" value={null} selected={false} onSelect={() => {}} />,
    );

    expect(on).toMatch(/^<button/);
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain('>12<');
    expect(off).toContain('aria-pressed="false"');
    expect(off).toContain('Chưa đủ dữ liệu');
  });
});

describe('Kbd', () => {
  it('renders a kbd element with the shortcut', () => {
    expect(renderToStaticMarkup(<Kbd>⌘K</Kbd>)).toMatch(/^<kbd[^>]*>⌘K<\/kbd>$/);
  });
});
