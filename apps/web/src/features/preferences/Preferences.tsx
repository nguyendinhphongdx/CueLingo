'use client';

import { type UserSettings } from '@cuelingo/shared';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { Button } from '@cuelingo/ui/components/button';
import { Section } from '@cuelingo/ui/components/section';
import { Segmented } from '@cuelingo/ui/components/segmented';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLanguage } from '../../lib/language';
import { usePreferences } from './use-preferences';

const assistOptions = [
  { value: '4', label: '4 · Đầy đủ' },
  { value: '3', label: '3 · Gợi ý' },
  { value: '1', label: '1 · Tối thiểu' },
  { value: '0', label: '0 · Ẩn' },
] as const;

interface PreferencesFormProps {
  settings: UserSettings;
  loading: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave(settings: UserSettings): Promise<unknown>;
  onChange(): void;
  /** Picks the language whose assist level is shown; hidden while only one language exists. */
  languageSwitcher?: ReactNode;
}

function RangeField({
  id,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange(value: number): void;
}) {
  return (
    <label htmlFor={id} className="block space-y-2 text-sm font-medium">
      <span className="flex items-baseline justify-between gap-4">
        {label}
        <span className="text-muted-foreground text-xs tabular-nums">
          {value}
          {suffix}
        </span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-primary h-8 w-full cursor-pointer"
      />
    </label>
  );
}

export function PreferencesForm({
  settings,
  loading,
  saving,
  saved,
  error,
  onSave,
  onChange,
  languageSwitcher,
}: PreferencesFormProps) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);

  const change = (next: UserSettings) => {
    setDraft(next);
    onChange();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave(draft).catch(() => undefined);
  };

  return (
    <Section
      title="Tuỳ chọn"
      description="Dùng cùng một thiết lập cho CueLingo trên web và các máy đã đăng nhập."
    >
      <form
        className="bg-card max-w-3xl space-y-5 rounded-xl border p-4 sm:p-5"
        onSubmit={(event) => void submit(event)}
      >
        {loading ? <p className="text-muted-foreground text-sm">Đang tải tuỳ chọn…</p> : null}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Mức hỗ trợ mặc định</p>
            {languageSwitcher}
          </div>
          <Segmented
            label="Mức hỗ trợ mặc định"
            value={String(draft.assistDefault)}
            disabled={loading || saving}
            onChange={(value) =>
              change({ ...draft, assistDefault: Number(value) as UserSettings['assistDefault'] })
            }
            options={[...assistOptions]}
          />
        </div>

        <div className="grid gap-5 border-t pt-5 sm:grid-cols-2">
          <RangeField
            id="overlay-font-size"
            label="Cỡ chữ overlay"
            value={draft.overlay.fontSize}
            min={14}
            max={28}
            suffix=" px"
            onChange={(fontSize) => change({ ...draft, overlay: { ...draft.overlay, fontSize } })}
          />
          <RangeField
            id="overlay-opacity"
            label="Độ đậm nền overlay"
            value={draft.overlay.opacity}
            min={55}
            max={100}
            suffix="%"
            onChange={(opacity) => change({ ...draft, overlay: { ...draft.overlay, opacity } })}
          />
        </div>

        <div className="space-y-2 border-t pt-5">
          <p className="text-sm font-medium">Giao diện overlay</p>
          <Segmented
            label="Giao diện overlay"
            value={draft.overlay.theme}
            disabled={loading || saving}
            onChange={(theme) => change({ ...draft, overlay: { ...draft.overlay, theme } })}
            options={[
              { value: 'dark', label: 'Tối' },
              { value: 'light', label: 'Sáng' },
            ]}
          />
        </div>

        {/* Keep-audio toggle hidden until backlog P2-06 (replay hard segments) stores audio. */}
        <div className="flex min-h-11 flex-wrap items-center gap-3 border-t pt-5">
          <Button type="submit" className="min-h-11" disabled={loading || saving}>
            {saving ? 'Đang lưu…' : 'Lưu tuỳ chọn'}
          </Button>
          {saved ? (
            <span role="status" className="text-sm">
              Đã lưu tuỳ chọn.
            </span>
          ) : null}
          {error ? (
            <span role="alert" className="text-destructive text-sm">
              {error}
            </span>
          ) : null}
        </div>
      </form>
    </Section>
  );
}

export function Preferences() {
  const { language, setLanguage, options } = useLanguage();
  const preferences = usePreferences(language);
  return (
    <PreferencesForm
      settings={preferences.settings}
      loading={preferences.loading}
      saving={preferences.saving}
      saved={preferences.saved}
      error={preferences.error}
      onSave={preferences.save}
      onChange={preferences.resetStatus}
      languageSwitcher={
        <LanguageSwitcher options={options} value={language} onChange={setLanguage} />
      }
    />
  );
}
