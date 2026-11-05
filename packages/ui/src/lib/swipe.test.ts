import { describe, expect, it } from 'vitest';
import { exitOffset, isTap, ratingForKey, swipeRating } from './swipe';

describe('swipeRating', () => {
  it('maps the four directions to ratings', () => {
    expect(swipeRating(150, 0)).toBe(3);
    expect(swipeRating(-150, 0)).toBe(1);
    expect(swipeRating(0, -150)).toBe(4);
    expect(swipeRating(0, 150)).toBe(2);
  });

  it('ignores a drag that stops short', () => {
    expect(swipeRating(60, 20)).toBeNull();
  });

  it('follows the longer axis', () => {
    expect(swipeRating(140, -100)).toBe(3);
    expect(swipeRating(-40, -160)).toBe(4);
  });
});

describe('tap and keys', () => {
  it('treats a tiny movement as a tap', () => {
    expect(isTap(2, 3)).toBe(true);
    expect(isTap(12, 0)).toBe(false);
  });

  it('gives the same rating for arrows and numbers', () => {
    expect(ratingForKey('ArrowRight')).toBe(ratingForKey('3'));
    expect(ratingForKey('ArrowLeft')).toBe(1);
    expect(ratingForKey('ArrowUp')).toBe(4);
    expect(ratingForKey('ArrowDown')).toBe(2);
    expect(ratingForKey('x')).toBeNull();
  });

  it('exits the way the card was thrown', () => {
    expect(exitOffset(3).x).toBeGreaterThan(0);
    expect(exitOffset(1).x).toBeLessThan(0);
    expect(exitOffset(4).y).toBeLessThan(0);
    expect(exitOffset(2).y).toBeGreaterThan(0);
  });
});
