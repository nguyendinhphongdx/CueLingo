import { useState, type FormEvent } from 'react';
import { Button } from './button';
import { Segmented } from './segmented';

export type FeedbackFormKind = 'bug' | 'idea';

export const FEEDBACK_LIMIT = 2000;
export const FEEDBACK_PRIVACY_NOTE = 'Không gửi kèm transcript hay âm thanh.';
export const FEEDBACK_SENT_TEXT = 'Đã gửi. Cảm ơn bạn đã góp ý!';
export const FEEDBACK_ERROR_TEXT = 'Chưa gửi được. Hãy thử lại sau ít phút.';

const KIND_OPTIONS: { value: FeedbackFormKind; label: string }[] = [
  { value: 'bug', label: 'Báo lỗi' },
  { value: 'idea', label: 'Góp ý' },
];

export interface FeedbackFormViewProps {
  kind: FeedbackFormKind;
  message: string;
  sending: boolean;
  sent: boolean;
  failed: boolean;
  onKind(kind: FeedbackFormKind): void;
  onMessage(message: string): void;
  onSubmit(): void;
}

/** The form as pure markup, so every state can be rendered and tested statically. */
export function FeedbackFormView({
  kind,
  message,
  sending,
  sent,
  failed,
  onKind,
  onMessage,
  onSubmit,
}: FeedbackFormViewProps) {
  const left = FEEDBACK_LIMIT - message.length;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <Segmented
        label="Loại phản hồi"
        options={KIND_OPTIONS}
        value={kind}
        onChange={onKind}
        disabled={sending}
      />
      <div>
        <label htmlFor="feedback-message" className="sr-only">
          Nội dung
        </label>
        <textarea
          id="feedback-message"
          value={message}
          maxLength={FEEDBACK_LIMIT}
          rows={6}
          disabled={sending}
          placeholder={
            kind === 'bug'
              ? 'Bạn đang làm gì, điều gì xảy ra, bạn mong đợi gì?'
              : 'Bạn muốn CueLingo làm được gì thêm?'
          }
          onChange={(event) => onMessage(event.target.value)}
          className="border-input bg-card placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-md border px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50 md:text-sm"
        />
        <div className="text-muted-foreground mt-1 flex justify-between text-xs">
          <span>{FEEDBACK_PRIVACY_NOTE}</span>
          <span aria-live="polite" className={left < 100 ? 'text-destructive' : undefined}>
            {message.length}/{FEEDBACK_LIMIT}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" className="min-h-10" disabled={sending || message.trim() === ''}>
          {sending ? 'Đang gửi…' : 'Gửi'}
        </Button>
        {sent && (
          <p role="status" className="text-sm">
            {FEEDBACK_SENT_TEXT}
          </p>
        )}
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {FEEDBACK_ERROR_TEXT}
          </p>
        )}
      </div>
    </form>
  );
}

/**
 * Bug report or idea from a tester. The caller supplies `send`, which attaches the app and OS version and
 * posts it; this component never sees them and has no way to attach anything else.
 */
export function FeedbackForm({
  send,
}: {
  send(input: { kind: FeedbackFormKind; message: string }): Promise<void>;
}) {
  const [kind, setKind] = useState<FeedbackFormKind>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const onSubmit = async () => {
    setSending(true);
    setSent(false);
    setFailed(false);
    try {
      await send({ kind, message: message.trim() });
      setMessage('');
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <FeedbackFormView
      kind={kind}
      message={message}
      sending={sending}
      sent={sent}
      failed={failed}
      onKind={(next) => {
        setKind(next);
        setSent(false);
      }}
      onMessage={(next) => {
        setMessage(next);
        setSent(false);
      }}
      onSubmit={() => void onSubmit()}
    />
  );
}
