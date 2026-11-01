import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('keeps the last conflicting Tailwind class', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('removes falsy values', () => {
    expect(cn('block', false, null, undefined, '', 'font-medium')).toBe('block font-medium');
  });
});
