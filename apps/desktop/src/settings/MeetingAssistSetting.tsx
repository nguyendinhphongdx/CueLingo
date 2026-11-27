import { ApiError } from '@cuelingo/core-sdk';
import type { MeetingAssistStatus } from '@cuelingo/shared';
import { Segmented } from '@cuelingo/ui/components/segmented';
import { useEffect, useState } from 'react';
import { CONSENT_TEXT } from '../quick-assist/MeetingAskPanel';
import { meetingAssistApi, type MeetingAssistApi } from '../quick-assist/meeting-assist-api';

/** Turns the consent for the meeting assistant on or off. Shown only when the server offers the assistant. */
export function MeetingAssistSetting({ api = meetingAssistApi }: { api?: MeetingAssistApi }) {
  const [status, setStatus] = useState<MeetingAssistStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void api.status().then(
      (next) => {
        if (!disposed) setStatus(next);
      },
      (reason: unknown) => {
        if (!disposed && !(reason instanceof ApiError && reason.status === 404)) {
          setError('Không đọc được cài đặt trợ lý trong họp.');
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, [api]);

  if (!status && !error) return null;
  // Withdrawing stays possible while the assistant is switched off on the server.
  if (status && !status.enabled && !status.consent) return null;

  async function change(granted: boolean) {
    setSaving(true);
    setError(null);
    try {
      setStatus(await api.setConsent(granted));
    } catch {
      setError('Chưa lưu được. Thử lại.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="meeting-assist-title" className="space-y-3">
      <div>
        <h2 id="meeting-assist-title" className="text-sm font-semibold">
          Trợ lý trong cuộc họp
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">{CONSENT_TEXT}</p>
      </div>
      {status ? (
        <Segmented
          label="Trợ lý trong cuộc họp"
          value={status.consent ? 'on' : 'off'}
          disabled={saving}
          onChange={(value) => void change(value === 'on')}
          options={[
            { value: 'off', label: 'Tắt' },
            { value: 'on', label: 'Đồng ý dùng' },
          ]}
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
