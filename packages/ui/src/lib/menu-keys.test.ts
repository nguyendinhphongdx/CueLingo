import { describe, expect, it } from 'vitest';
import { clampMenuPosition, menuKeyAction } from './menu-keys';

describe('menuKeyAction', () => {
  it('closes on Escape, even when empty', () => {
    expect(menuKeyAction('Escape', 0, 3)).toEqual({ type: 'close' });
    expect(menuKeyAction('Escape', -1, 0)).toEqual({ type: 'close' });
  });
  it('wraps arrows around the items and supports Home and End', () => {
    expect(menuKeyAction('ArrowDown', 2, 3)).toEqual({ type: 'focus', index: 0 });
    expect(menuKeyAction('ArrowUp', 0, 3)).toEqual({ type: 'focus', index: 2 });
    expect(menuKeyAction('ArrowDown', -1, 3)).toEqual({ type: 'focus', index: 0 });
    expect(menuKeyAction('Home', 2, 3)).toEqual({ type: 'focus', index: 0 });
    expect(menuKeyAction('End', 0, 3)).toEqual({ type: 'focus', index: 2 });
  });
  it('leaves other keys alone', () => {
    expect(menuKeyAction('a', 0, 3)).toBeNull();
    expect(menuKeyAction('ArrowDown', 0, 0)).toBeNull();
  });
});

describe('clampMenuPosition', () => {
  const size = { width: 200, height: 100 };
  const viewport = { width: 800, height: 600 };
  it('keeps the point when there is room', () => {
    expect(clampMenuPosition({ x: 100, y: 100 }, size, viewport)).toEqual({ left: 100, top: 100 });
  });
  it('pulls the menu back inside the viewport', () => {
    expect(clampMenuPosition({ x: 790, y: 590 }, size, viewport)).toEqual({ left: 592, top: 492 });
    expect(clampMenuPosition({ x: -5, y: 0 }, size, viewport)).toEqual({ left: 8, top: 8 });
  });
});
