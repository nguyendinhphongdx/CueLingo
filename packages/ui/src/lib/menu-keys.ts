export type MenuKeyAction = { type: 'close' } | { type: 'focus'; index: number } | null;

/** What a key does in a small menu: Escape closes; arrows, Home and End move the focus around the items. */
export function menuKeyAction(key: string, index: number, count: number): MenuKeyAction {
  if (key === 'Escape') return { type: 'close' };
  if (count <= 0) return null;
  if (key === 'ArrowDown') return { type: 'focus', index: (index + 1) % count };
  if (key === 'ArrowUp') return { type: 'focus', index: (index - 1 + count) % count };
  if (key === 'Home') return { type: 'focus', index: 0 };
  if (key === 'End') return { type: 'focus', index: count - 1 };
  return null;
}

/** Keeps a menu of `width` × `height` inside the viewport, `margin` away from its edges. */
export function clampMenuPosition(
  at: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): { left: number; top: number } {
  const clamp = (value: number, extent: number, limit: number) =>
    Math.max(margin, Math.min(value, limit - extent - margin));
  return {
    left: clamp(at.x, size.width, viewport.width),
    top: clamp(at.y, size.height, viewport.height),
  };
}
