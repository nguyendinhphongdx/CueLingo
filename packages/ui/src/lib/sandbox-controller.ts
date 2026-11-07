import { BRIDGE_VERSION, type BridgeHostMessage, type BridgeOp } from '@cuelingo/shared';
import {
  createBridgeHost,
  type BridgeHandlers,
  type BridgeMessageEvent,
  type RejectReason,
} from './bridge-host';
import type { SandboxEvent } from './sandbox-state';
import { createWatchdog } from './sandbox-watchdog';

export interface SandboxControllerOptions {
  html: string;
  /** The runner iframe's window; null before it exists. */
  getFrameWindow(): unknown;
  /** Sends a message into the runner (target origin "*": a sandboxed frame has an opaque origin). */
  post(message: BridgeHostMessage): void;
  dispatch(event: SandboxEvent): void;
  /** Asks the person, in the host's own dialog. Must resolve false if they cancel or the block goes away. */
  askToSave(input: { phrase: string; meaningVi?: string }): Promise<boolean>;
  /** Asks whether the block may read the saved phrases. Must resolve false if they cancel or the block goes away. */
  askToList(): Promise<boolean>;
  listPhrases: BridgeHandlers['listPhrases'];
  savePhrase: BridgeHandlers['savePhrase'];
  speak: BridgeHandlers['speak'];
  /** Told about every refused message; the reason and an allowlisted operation name, never contents. */
  onRejected?(info: { reason: RejectReason; op: BridgeOp | 'unknown' }): void;
  /** Called once when the block stops, before `dispatch`, so a pending dialog can be closed. */
  onStopped?(): void;
}

export interface SandboxController {
  /** The runner iframe finished loading: send the page and start the watchdog. */
  onFrameLoad(): void;
  handleMessage(event: BridgeMessageEvent): Promise<void>;
  dispose(): void;
}

/**
 * One block's life, apart from React: send the page when the runner loaded, watch it, answer its requests through the
 * bridge, and stop it when it stalls or reports an error. The component only supplies the iframe and the dialog.
 */
export function createSandboxController(options: SandboxControllerOptions): SandboxController {
  let stopped = false;
  let rendered = false;

  /** A block that keeps asking after being refused is wearing the person down: it is removed at this many refusals. */
  const MAX_REFUSALS = 2;
  let refusals = 0;
  let mayList = false;
  const refused = () => {
    refusals += 1;
    if (refusals >= MAX_REFUSALS) stop('refused');
  };

  const stop = (reason: 'no_ready' | 'no_pong' | 'error' | 'refused') => {
    if (stopped) return;
    stopped = true;
    watchdog.stop();
    host.dispose();
    options.onStopped?.();
    options.dispatch({ type: 'stopped', reason });
  };

  const watchdog = createWatchdog({
    ping: (n) => options.post({ v: BRIDGE_VERSION, kind: 'ping', n }),
    onStalled: stop,
  });

  const host = createBridgeHost({
    getFrameWindow: options.getFrameWindow,
    reply: (response) => options.post({ v: BRIDGE_VERSION, kind: 'reply', response }),
    onRejected: options.onRejected,
    handlers: {
      resize: (height) => options.dispatch({ type: 'resize', height }),
      ready: () => {
        watchdog.ready();
        options.dispatch({ type: 'ready' });
      },
      error: () => stop('error'),
      pong: (n) => watchdog.pong(n),
      // Reading the saved phrases asks once per block: a page that can read them and also reach the network by a
      // route the browser cannot close (a navigation resolves its target's host name) could carry them out.
      listPhrases: async () => {
        if (!mayList) {
          if (stopped || !(await options.askToList())) {
            if (!stopped) refused();
            throw new Error('declined');
          }
          mayList = true;
        }
        return options.listPhrases();
      },
      confirmSave: async (input) => {
        const agreed = await options.askToSave(input);
        if (!agreed && !stopped) refused();
        return agreed;
      },
      savePhrase: options.savePhrase,
      speak: options.speak,
    },
  });

  return {
    onFrameLoad() {
      // Once only: a reload of the iframe must not send the page twice (the runner would ignore it anyway).
      if (stopped || rendered) return;
      rendered = true;
      options.post({ v: BRIDGE_VERSION, kind: 'render', html: options.html });
      watchdog.start();
    },
    handleMessage: (event) => host.handleMessage(event),
    dispose() {
      stopped = true;
      watchdog.stop();
      host.dispose();
      options.onStopped?.();
    },
  };
}
