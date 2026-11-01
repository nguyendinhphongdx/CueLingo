import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './button';
import { Card } from './card';
import { Input } from './input';

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
