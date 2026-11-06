import { useEffect, useReducer, useRef, useState, type RefObject } from 'react';
import type { BridgePhrase } from '../lib/bridge-host';
import { createSandboxController, type SandboxController } from '../lib/sandbox-controller';
import {
  SANDBOX_ALLOW,
  SANDBOX_FLAGS,
  SANDBOX_REFERRER_POLICY,
  runnerUrl,
} from '../lib/sandbox-attrs';
import {
  initialSandboxState,
  sandboxReducer,
  stopReasonText,
  type SandboxState,
} from '../lib/sandbox-state';
import { cn } from '../lib/utils';
import { Button } from './button';
import { ConfirmDialog } from './confirm-dialog';

export interface SandboxFrameProps {
  /** The page the assistant wrote. Fixed for the life of the block; a different page is a different block. */
  html: string;
  title?: string;
  /** Origin of the sandbox runner (`https://sandbox.<domain>`); never the origin of this app. */
  runnerOrigin: string;
  /** Reads the person's saved phrases (the host's own client; the block never gets a token). */
  onListPhrases(): Promise<BridgePhrase[]>;
  /** Saves a phrase. Only called after the person agreed in the dialog this component shows. */
  onSavePhrase(input: { phrase: string; meaningVi?: string }): Promise<void>;
  onSpeak(text: string): void | Promise<void>;
  className?: string;
}

/** The pure part: what a block looks like in each state. The iframe is only present while it can run. */
export function SandboxFrameView({
  state,
  src,
  title,
  html,
  iframeRef,
  onLoad,
  onToggleSource,
  className,
}: {
  state: SandboxState;
  src: string | null;
  title?: string;
  html: string;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  onLoad?: () => void;
  onToggleSource: () => void;
  className?: string;
}) {
  const stopped = state.phase === 'stopped';
  return (
    <figure
      data-sandbox-phase={state.phase}
      className={cn('bg-card w-full max-w-[640px] overflow-hidden rounded-2xl border', className)}
    >
      {!stopped && src ? (
        <iframe
          ref={iframeRef}
          src={src}
          title={title ?? 'Khối giao diện do trợ lý tạo'}
          // Scripts only. No allow-same-origin: the page gets an opaque origin and cannot reach this app,
          // its cookies or its storage. Do not add flags here (see lib/sandbox-attrs.ts).
          sandbox={SANDBOX_FLAGS}
          allow={SANDBOX_ALLOW}
          referrerPolicy={SANDBOX_REFERRER_POLICY}
          loading="lazy"
          onLoad={onLoad}
          style={{ height: state.height }}
          className="block w-full border-0"
        />
      ) : null}
      {stopped ? (
        <div role="status" className="space-y-1 p-4 text-sm">
          <p className="font-medium">Khối giao diện đã bị dừng</p>
          <p className="text-muted-foreground">{stopReasonText(state.reason)}</p>
        </div>
      ) : null}
      <figcaption className="flex items-center justify-between gap-2 border-t px-3 py-1.5">
        <span className="text-muted-foreground min-w-0 truncate text-xs">
          {title ?? 'Khối giao diện do trợ lý tạo'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-8 shrink-0"
          aria-expanded={state.showSource}
          onClick={onToggleSource}
        >
          {state.showSource ? 'Ẩn mã nguồn' : 'Xem mã nguồn'}
        </Button>
      </figcaption>
      {state.showSource ? (
        // Text, not markup: React escapes it, so reading the source can never run it.
        <pre
          aria-label="Mã nguồn của khối giao diện"
          className="bg-muted max-h-72 overflow-auto border-t p-3 text-xs break-words whitespace-pre-wrap"
        >
          {html}
        </pre>
      ) : null}
    </figure>
  );
}

interface PendingSave {
  phrase: string;
  meaningVi?: string;
}

function SandboxSession({
  html,
  title,
  runnerOrigin,
  onListPhrases,
  onSavePhrase,
  onSpeak,
  className,
}: SandboxFrameProps) {
  const src = runnerUrl(runnerOrigin);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [state, dispatch] = useReducer(sandboxReducer, src === null, initialSandboxState);
  const [confirm, setConfirm] = useState<PendingSave | null>(null);
  // The callbacks change identity every render; the session reads the latest without restarting.
  const latest = useRef({ onListPhrases, onSavePhrase, onSpeak });
  const controller = useRef<SandboxController | null>(null);
  const loaded = useRef(false);
  const answer = useRef<((agreed: boolean) => void) | null>(null);

  useEffect(() => {
    latest.current = { onListPhrases, onSavePhrase, onSpeak };
  });

  useEffect(() => {
    if (!src) return;
    const session = createSandboxController({
      html,
      getFrameWindow: () => iframeRef.current?.contentWindow ?? null,
      // The runner's origin is opaque under the sandbox flags, so "*" is the only target that delivers.
      post: (message) => iframeRef.current?.contentWindow?.postMessage(message, '*'),
      dispatch,
      askToSave: (input) =>
        new Promise<boolean>((resolve) => {
          answer.current = (agreed) => {
            answer.current = null;
            setConfirm(null);
            resolve(agreed);
          };
          setConfirm(input);
        }),
      listPhrases: () => latest.current.onListPhrases(),
      savePhrase: (input) => latest.current.onSavePhrase(input),
      speak: (text) => latest.current.onSpeak(text),
      onRejected: ({ reason, op }) => console.warn('[sandbox] message refused', reason, op),
      onStopped: () => answer.current?.(false),
    });
    controller.current = session;
    const onMessage = (event: MessageEvent) => void session.handleMessage(event);
    window.addEventListener('message', onMessage);
    // The frame may have finished loading before this effect ran.
    if (loaded.current) session.onFrameLoad();
    return () => {
      window.removeEventListener('message', onMessage);
      session.dispose();
      controller.current = null;
    };
  }, [src, html]);

  return (
    <>
      <SandboxFrameView
        state={state}
        src={src}
        title={title}
        html={html}
        iframeRef={iframeRef}
        onLoad={() => {
          loaded.current = true;
          controller.current?.onFrameLoad();
        }}
        onToggleSource={() => dispatch({ type: 'toggleSource' })}
        className={className}
      />
      <ConfirmDialog
        open={confirm !== null}
        title="Lưu cụm từ này?"
        confirmLabel="Lưu"
        cancelLabel="Huỷ"
        onCancel={() => answer.current?.(false)}
        onConfirm={() => answer.current?.(true)}
      >
        Khối giao diện muốn lưu “{confirm?.phrase}”
        {confirm?.meaningVi ? ` (${confirm.meaningVi})` : ''} vào Cụm từ của bạn. Chỉ lưu nếu bạn
        đồng ý.
      </ConfirmDialog>
    </>
  );
}

/**
 * A block of HTML/JS the assistant wrote (ADR 0019, layer 2), run in the sandbox runner: an iframe with
 * `sandbox="allow-scripts"` on its own origin, a watchdog that removes it when it stalls, and a bridge that
 * answers only the allowlisted operations. Saving a phrase always asks the person first, in a dialog drawn here.
 */
export function SandboxFrame(props: SandboxFrameProps) {
  return <SandboxSession key={`${props.runnerOrigin}\n${props.html}`} {...props} />;
}
