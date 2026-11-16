import { useMemo } from 'react';
import { encode } from 'uqr';

/** Quiet zone around the code, in modules (the encoder is asked for no border of its own): the QR spec asks for 4 so scanners find the edges. */
const QUIET_ZONE = 4;

/** One path with a rectangle per run of dark modules in a row. */
function pathOf(matrix: boolean[][]): string {
  const parts: string[] = [];
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      parts.push(`M${start + QUIET_ZONE} ${y + QUIET_ZONE}h${x - start}v1h-${x - start}z`);
    }
  });
  return parts.join('');
}

/**
 * Draws a QR code as inline SVG (no image request, so it fits `img-src 'self' data:`). Black on white whatever the
 * theme: phone cameras and bank apps need that contrast, so these two colours are not design tokens.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const drawn = useMemo(() => {
    try {
      const matrix = encode(value, { ecc: 'M', border: 0 }).data;
      return { size: matrix.length + QUIET_ZONE * 2, d: pathOf(matrix) };
    } catch {
      // Too long for a QR code: the page still has the PayOS link and the transfer details.
      return null;
    }
  }, [value]);
  if (!drawn) return null;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${drawn.size} ${drawn.size}`}
      shapeRendering="crispEdges"
      className="size-56 max-w-full rounded-md"
    >
      <rect width={drawn.size} height={drawn.size} fill="#fff" />
      <path d={drawn.d} fill="#000" />
    </svg>
  );
}
