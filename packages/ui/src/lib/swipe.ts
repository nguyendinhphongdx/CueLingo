/** FSRS ratings the deck can give: 1 again · 2 hard · 3 good · 4 easy. */
export type DeckRating = 1 | 2 | 3 | 4;

/** Pixels a drag must travel before it counts as a swipe rather than a tap. */
export const SWIPE_THRESHOLD = 90;
export const TAP_SLOP = 10;

/**
 * What a drag means. Right is "Được" (3), left is "Lại" (1), up is "Dễ" (4), down is "Khó" (2).
 * The longer axis wins, so a mostly-sideways drag with a little wobble is still sideways.
 */
export function swipeRating(
  dx: number,
  dy: number,
  threshold = SWIPE_THRESHOLD,
): DeckRating | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 3 : 1;
  return dy < 0 ? 4 : 2;
}

/** True when the pointer moved so little that the gesture was a tap. */
export function isTap(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) < TAP_SLOP;
}

/** Keyboard shortcuts once the card is turned: arrows mirror the swipes, 1–4 name the rating. */
export function ratingForKey(key: string): DeckRating | null {
  switch (key) {
    case 'ArrowRight':
    case '3':
      return 3;
    case 'ArrowLeft':
    case '1':
      return 1;
    case 'ArrowUp':
    case '4':
      return 4;
    case 'ArrowDown':
    case '2':
      return 2;
    default:
      return null;
  }
}

/** The offset the card flies to when it leaves, so it exits the way it was thrown. */
export function exitOffset(rating: DeckRating, distance = 700): { x: number; y: number } {
  if (rating === 3) return { x: distance, y: 0 };
  if (rating === 1) return { x: -distance, y: 0 };
  return { x: 0, y: rating === 4 ? -distance : distance };
}
