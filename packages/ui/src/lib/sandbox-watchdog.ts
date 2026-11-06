/** Why a block was stopped by the watchdog. */
export type StallReason = 'no_ready' | 'no_pong';

export interface WatchdogOptions {
  /** Sends the nth ping into the frame. */
  ping(n: number): void;
  /** Called once, when the frame did not become ready or stopped answering. */
  onStalled(reason: StallReason): void;
  /** The frame must say `ui.ready` within this long after `start`. Default 3 s. */
  readyTimeoutMs?: number;
  /** A ping goes out this often; it must be answered before the next one. Default 2 s. */
  pingIntervalMs?: number;
}

export interface Watchdog {
  /** The frame has loaded: begin waiting for `ui.ready`. */
  start(): void;
  /** `ui.ready` arrived: stop waiting for it and begin pinging. */
  ready(): void;
  /** A pong arrived for ping `n`. */
  pong(n: number): void;
  /** Cancels every timer; nothing fires afterwards. */
  stop(): void;
}

/**
 * Liveness of a sandboxed block (AC8). Same-origin code in a loop would freeze everything, but the runner is on its own
 * origin, so a page stuck in `while(true)` stops answering pings while the chat stays usable. The watchdog notices and
 * the host removes the frame. Timers are the globals, so tests drive it with fake timers.
 */
export function createWatchdog(options: WatchdogOptions): Watchdog {
  const { readyTimeoutMs = 3000, pingIntervalMs = 2000 } = options;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let sent = 0;
  let awaiting: number | null = null;
  let finished = false;

  const stop = () => {
    finished = true;
    clearTimeout(readyTimer);
    clearInterval(pingTimer);
    readyTimer = undefined;
    pingTimer = undefined;
  };
  const stall = (reason: StallReason) => {
    if (finished) return;
    stop();
    options.onStalled(reason);
  };

  return {
    start() {
      if (finished || readyTimer) return;
      readyTimer = setTimeout(() => stall('no_ready'), readyTimeoutMs);
    },
    ready() {
      if (finished || pingTimer) return;
      clearTimeout(readyTimer);
      readyTimer = undefined;
      pingTimer = setInterval(() => {
        if (awaiting !== null) return stall('no_pong');
        sent += 1;
        awaiting = sent;
        options.ping(sent);
      }, pingIntervalMs);
    },
    pong(n) {
      if (n === awaiting) awaiting = null;
    },
    stop,
  };
}
