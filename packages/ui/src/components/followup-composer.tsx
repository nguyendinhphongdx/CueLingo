import { Loader2 } from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import {
  buildFollowupCopyText,
  currentTone,
  draftMismatch,
  followupReducer,
  initialFollowupState,
  type FollowupComposerChannel,
  type FollowupComposerState,
  type FollowupComposerTone,
} from '../lib/followup-composer-state';
import { Button } from './button';
import { ConfirmDialog } from './confirm-dialog';
import { Input } from './input';
import { Segmented } from './segmented';

export type { FollowupComposerChannel, FollowupComposerTone };
export { buildFollowupCopyText, defaultToneFor } from '../lib/followup-composer-state';

export interface FollowupDraft {
  subject: string | null;
  body: string;
}

export const FOLLOWUP_CHANNEL_OPTIONS: { value: FollowupComposerChannel; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'chat', label: 'Tin nhắn nhóm' },
];
export const FOLLOWUP_TONE_OPTIONS: { value: FollowupComposerTone; label: string }[] = [
  { value: 'brief', label: 'Ngắn gọn' },
  { value: 'polite', label: 'Lịch sự' },
  { value: 'friendly', label: 'Thân mật' },
];
export const FOLLOWUP_REVIEW_NOTE = 'Kiểm tra lại trước khi gửi.';
export const FOLLOWUP_ERROR_TEXT = 'Không soạn được bản nháp. Hãy thử lại.';
export const FOLLOWUP_COPY_FALLBACK_TEXT =
  'Không sao chép được. Văn bản đầy đủ (gồm tiêu đề) đã được chọn sẵn bên dưới.';
export const FOLLOWUP_MISMATCH_TEXT = 'Bản nháp này soạn cho kênh/giọng khác. Bấm Soạn lại để đổi.';
export const FOLLOWUP_REDRAFT_CONFIRM_TEXT = 'Soạn lại sẽ thay bản nháp bạn đã sửa. Tiếp tục?';

export interface FollowupComposerViewProps {
  state: FollowupComposerState;
  /** Asking whether to replace an edited draft. */
  confirmingRedraft?: boolean;
  onChannel(channel: FollowupComposerChannel): void;
  onTone(tone: FollowupComposerTone): void;
  onSubject(subject: string): void;
  onBody(body: string): void;
  onCompose(): void;
  onConfirmRedraft(): void;
  onCancelRedraft(): void;
  onCopy(): void;
  bodyRef?: React.Ref<HTMLTextAreaElement>;
  fallbackRef?: React.Ref<HTMLTextAreaElement>;
}

/** The composer as pure markup: every state is a prop so it can be rendered and tested statically. */
export function FollowupComposerView({
  state,
  confirmingRedraft = false,
  onChannel,
  onTone,
  onSubject,
  onBody,
  onCompose,
  onConfirmRedraft,
  onCancelRedraft,
  onCopy,
  bodyRef,
  fallbackRef,
}: FollowupComposerViewProps) {
  const { draft, status, errorMessage, copyState, fallbackText } = state;
  const loading = status === 'loading';
  return (
    <div className="space-y-4" data-followup-composer="">
      <div className="flex flex-wrap gap-4">
        <Segmented
          label="Kênh"
          options={FOLLOWUP_CHANNEL_OPTIONS}
          value={state.channel}
          onChange={onChannel}
          disabled={loading}
        />
        <Segmented
          label="Giọng"
          options={FOLLOWUP_TONE_OPTIONS}
          value={currentTone(state)}
          onChange={onTone}
          disabled={loading}
        />
      </div>
      <Button onClick={onCompose} disabled={loading} aria-busy={loading}>
        {loading ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            Đang soạn…
          </>
        ) : draft ? (
          'Soạn lại'
        ) : (
          'Soạn'
        )}
      </Button>
      {draftMismatch(state) ? (
        <p className="text-muted-foreground text-xs">{FOLLOWUP_MISMATCH_TEXT}</p>
      ) : null}
      {status === 'error' ? (
        <div role="alert" className="text-destructive flex flex-wrap items-center gap-2 text-sm">
          <span>{errorMessage || FOLLOWUP_ERROR_TEXT}</span>
          <Button variant="outline" size="sm" onClick={onCompose}>
            Thử lại
          </Button>
        </div>
      ) : null}
      <div aria-live="polite" className="space-y-3">
        {draft ? (
          <>
            {draft.channel === 'email' ? (
              <Input
                aria-label="Tiêu đề"
                value={draft.subject ?? ''}
                onChange={(event) => onSubject(event.target.value)}
              />
            ) : null}
            <textarea
              ref={bodyRef}
              aria-label="Nội dung"
              rows={10}
              value={draft.body}
              onChange={(event) => onBody(event.target.value)}
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={onCopy}>
                Sao chép
              </Button>
              {copyState === 'copied' ? (
                <span role="status" className="text-muted-foreground text-sm">
                  Đã sao chép
                </span>
              ) : null}
            </div>
            {copyState === 'fallback' && fallbackText !== null ? (
              <div className="space-y-2">
                <p role="status" className="text-muted-foreground text-sm">
                  {FOLLOWUP_COPY_FALLBACK_TEXT}
                </p>
                <textarea
                  ref={fallbackRef}
                  readOnly
                  aria-label="Văn bản đầy đủ để sao chép"
                  rows={10}
                  value={fallbackText}
                  className="border-input bg-muted/40 w-full rounded-md border px-3 py-2 text-sm outline-none"
                />
              </div>
            ) : null}
            <p className="text-muted-foreground text-xs">{FOLLOWUP_REVIEW_NOTE}</p>
          </>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmingRedraft}
        title="Soạn lại bản nháp"
        confirmLabel="Soạn lại"
        cancelLabel="Giữ bản nháp"
        onConfirm={onConfirmRedraft}
        onCancel={onCancelRedraft}
      >
        {FOLLOWUP_REDRAFT_CONFIRM_TEXT}
      </ConfirmDialog>
    </div>
  );
}

export interface FollowupComposerProps {
  onCompose(input: {
    channel: FollowupComposerChannel;
    tone: FollowupComposerTone;
  }): Promise<FollowupDraft>;
  defaultChannel?: FollowupComposerChannel;
  defaultTone?: FollowupComposerTone;
  /** Where the text goes; defaults to the clipboard. Reject to fall back to selecting the text. */
  onCopy?(text: string): Promise<void> | void;
  /** Turns a rejected compose into a message for the person. */
  describeError?(error: unknown): string;
}

const COPIED_MS = 2000;

async function writeClipboard(text: string) {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard) throw new Error('Clipboard unavailable');
  await clipboard.writeText(text);
}

/** Drafts a follow-up message for a finished meeting; shared by the web and the desktop app. */
export function FollowupComposer({
  onCompose,
  defaultChannel = 'email',
  defaultTone,
  onCopy = writeClipboard,
  describeError,
}: FollowupComposerProps) {
  const [state, dispatch] = useReducer(followupReducer, undefined, () =>
    initialFollowupState(defaultChannel, defaultTone ?? null),
  );
  const [confirmingRedraft, setConfirmingRedraft] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous, so two clicks in the same tick cannot both start a request.
  const inFlight = useRef(false);
  const latestRequest = useRef(0);
  const focusBody = useRef(false);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
      latestRequest.current = -1;
    },
    [],
  );

  useEffect(() => {
    if (focusBody.current && state.draft) {
      focusBody.current = false;
      bodyRef.current?.focus();
    }
  }, [state.draft]);

  useEffect(() => {
    if (state.copyState === 'fallback') {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [state.copyState, state.fallbackText]);

  const compose = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    const input = { channel: state.channel, tone: currentTone(state) };
    dispatch({ type: 'start', requestId });
    try {
      const result = await onCompose(input);
      focusBody.current = true;
      dispatch({ type: 'success', requestId, ...input, ...result });
    } catch (error) {
      dispatch({ type: 'failure', requestId, message: describeError?.(error) });
    } finally {
      if (latestRequest.current === requestId) inFlight.current = false;
    }
  };

  const copy = async () => {
    const { draft } = state;
    if (!draft) return;
    if (copyTimer.current) clearTimeout(copyTimer.current);
    const text = buildFollowupCopyText(draft);
    try {
      await onCopy(text);
      dispatch({ type: 'copied' });
      copyTimer.current = setTimeout(() => dispatch({ type: 'copy-reset' }), COPIED_MS);
    } catch {
      dispatch({ type: 'copy-fallback', text });
    }
  };

  return (
    <FollowupComposerView
      state={state}
      confirmingRedraft={confirmingRedraft}
      onChannel={(channel) => dispatch({ type: 'channel', channel })}
      onTone={(tone) => dispatch({ type: 'tone', tone })}
      onSubject={(subject) => dispatch({ type: 'subject', subject })}
      onBody={(body) => dispatch({ type: 'body', body })}
      onCompose={() => {
        if (state.draft?.edited && state.status !== 'loading') setConfirmingRedraft(true);
        else void compose();
      }}
      onConfirmRedraft={() => {
        setConfirmingRedraft(false);
        void compose();
      }}
      onCancelRedraft={() => setConfirmingRedraft(false)}
      onCopy={() => void copy()}
      bodyRef={bodyRef}
      fallbackRef={fallbackRef}
    />
  );
}
