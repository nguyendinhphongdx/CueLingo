import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
} from '@tauri-apps/api/window';
import { useEffect, useRef } from 'react';

/**
 * Makes room for a side drawer by widening the overlay window instead of squeezing the captions,
 * and shrinks it back when the drawer closes. If the wider window would run off the screen it
 * slides left. Outside Tauri (a browser preview) it does nothing.
 */
export function useDrawerWindow(open: boolean, drawerWidth: number) {
  const grown = useRef(0);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    queue.current = queue.current.then(async () => {
      try {
        const win = getCurrentWindow();
        const scale = await win.scaleFactor();
        const size = (await win.innerSize()).toLogical(scale);

        if (open && grown.current === 0) {
          await win.setSize(new LogicalSize(size.width + drawerWidth, size.height));
          grown.current = drawerWidth;

          const monitor = await currentMonitor();
          const position = await win.outerPosition();
          if (monitor) {
            const right = position.x + (size.width + drawerWidth) * scale;
            const edge = monitor.position.x + monitor.size.width;
            if (right > edge) {
              const x = Math.max(monitor.position.x, position.x - (right - edge));
              await win.setPosition(new PhysicalPosition(Math.round(x), position.y));
            }
          }
        } else if (!open && grown.current > 0) {
          await win.setSize(
            new LogicalSize(Math.max(320, size.width - grown.current), size.height),
          );
          grown.current = 0;
        }
      } catch {
        // Not running inside the app window: the layout still works, the window just keeps its size.
      }
    });
  }, [open, drawerWidth]);
}
