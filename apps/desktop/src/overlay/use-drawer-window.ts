import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
} from '@tauri-apps/api/window';
import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 220;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** The window cannot be resized by CSS, so these are the only calls that touch it. */
async function windowGeometry() {
  const win = getCurrentWindow();
  const scale = await win.scaleFactor();
  const size = (await win.innerSize()).toLogical(scale);
  const position = await win.outerPosition();
  const monitor = await currentMonitor();
  return { win, scale, size, position, monitor };
}

/**
 * Makes room for a side drawer by widening the overlay window instead of squeezing the captions.
 * It returns the drawer's current width (0 → `drawerWidth`), animated, and widens or narrows the
 * window frame by frame in step with it, sliding the window left if it would run off the screen.
 * Outside Tauri (a browser preview) only the returned width animates.
 */
export function useDrawerWindow(open: boolean, drawerWidth: number): number {
  const [width, setWidth] = useState(0);
  const current = useRef(0);
  const frame = useRef(0);
  /** Where the window sat with the drawer shut, and how far it slides left when the drawer is open. */
  const home = useRef<{ x: number; slide: number } | null>(null);

  useEffect(() => {
    const target = open ? drawerWidth : 0;
    const from = current.current;
    if (from === target) return;

    let cancelled = false;
    const reduceMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduceMotion ? 0 : DURATION_MS;

    void (async () => {
      let geometry: Awaited<ReturnType<typeof windowGeometry>> | null = null;
      try {
        geometry = await windowGeometry();
      } catch {
        geometry = null; // not inside the app window
      }
      if (cancelled) return;

      // Window width without the drawer; remember its home position the first time the drawer opens.
      const base = geometry ? geometry.size.width - from : 0;
      if (geometry && from === 0) {
        let slide = 0;
        if (geometry.monitor) {
          const right = geometry.position.x + (base + drawerWidth) * geometry.scale;
          const edge = geometry.monitor.position.x + geometry.monitor.size.width;
          slide = Math.max(0, right - edge);
          slide = Math.min(slide, geometry.position.x - geometry.monitor.position.x);
        }
        home.current = { x: geometry.position.x, slide };
      }

      let busy = false;
      let latest = from;
      const push = async (value: number) => {
        latest = value;
        if (!geometry || busy) return;
        busy = true;
        try {
          while (true) {
            const next = latest;
            await geometry.win.setSize(
              new LogicalSize(Math.max(320, base + next), geometry.size.height),
            );
            if (home.current && home.current.slide > 0) {
              const x = home.current.x - (home.current.slide * next) / drawerWidth;
              await geometry.win.setPosition(
                new PhysicalPosition(Math.round(x), geometry.position.y),
              );
            }
            if (next === latest) break;
          }
        } catch {
          // The window may be closing; nothing to do.
        } finally {
          busy = false;
        }
      };

      const startedAt = performance.now();
      const step = (now: number) => {
        if (cancelled) return;
        const t = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
        const value = from + (target - from) * easeOut(t);
        current.current = value;
        setWidth(value);
        void push(value);
        if (t < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame.current);
    };
  }, [open, drawerWidth]);

  return width;
}
