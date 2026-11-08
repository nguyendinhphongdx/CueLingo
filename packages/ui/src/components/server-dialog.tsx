import { useEffect, useId, useState } from 'react';
import { Button } from './button';
import { Input } from './input';

/** An API address and a web address. The same shape the app keeps; kept here so the UI package stays standalone. */
export interface ServerDialogChoice {
  api: string;
  web: string;
}

export type ServerDialogUrlCheck = { ok: true; url: string } | { ok: false; reason: string };
export type ServerDialogCheckResult = { ok: true } | { ok: false; cause: string };

export const SERVER_PRESET_DEFAULT_LABEL = 'CueLingo Beta (mặc định)';
export const SERVER_PRESET_LOCAL_LABEL = 'Máy tính này (localhost, chỉ bản lập trình)';
export const SERVER_PRESET_CUSTOM_LABEL = 'Tuỳ chỉnh…';
export const SERVER_LOCAL_CHOICE: ServerDialogChoice = {
  api: 'http://localhost:4000',
  web: 'http://localhost:3000',
};

export const serverWarningText = (host: string) =>
  `Tài khoản và nội dung cuộc họp của bạn sẽ được gửi tới ${host}. Chỉ chọn máy chủ mà bạn tin tưởng.`;
export const SERVER_RESTART_TEXT = 'CueLingo sẽ khởi động lại để áp dụng máy chủ mới.';
export const SERVER_SIGNOUT_TEXT = 'Bạn sẽ được đăng xuất khỏi máy chủ hiện tại trước khi đổi.';
export const SERVER_CHECK_FAILED_CONFIRM_TEXT =
  'Chưa kết nối được tới máy chủ này. Nếu lưu, bạn có thể không đăng nhập hay dùng được app cho tới khi đặt lại.';

export interface ServerDialogProps {
  open: boolean;
  /** The server in use now. */
  current: ServerDialogChoice;
  /** The server built into the app: the "CueLingo Beta (mặc định)" choice. */
  defaultChoice: ServerDialogChoice;
  /** Development build: shows the localhost choice. */
  devMode: boolean;
  signedIn: boolean;
  /** Checks one address (https only, localhost in a development build) and returns it cleaned up. */
  validate(url: string): ServerDialogUrlCheck;
  /** Calls the server's health endpoint. Must not log the address. */
  onCheck(apiUrl: string): Promise<ServerDialogCheckResult>;
  /** The person agreed. The app signs out, saves and restarts. */
  onSave(choice: ServerDialogChoice): void | Promise<void>;
  onClose(): void;
  /** A failure of the save step, shown in the dialog. */
  saveError?: string | null;
}

type Preset = 'default' | 'local' | 'custom';
type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok' | 'failed'; target: string; cause?: string };

const same = (a: ServerDialogChoice, b: ServerDialogChoice) => a.api === b.api && a.web === b.web;

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Opens closed-to-open fresh each time, so a half-typed address never survives a cancel. */
export function ServerDialog(props: ServerDialogProps) {
  return props.open ? <OpenServerDialog {...props} /> : null;
}

function OpenServerDialog({
  current,
  defaultChoice,
  devMode,
  signedIn,
  validate,
  onCheck,
  onSave,
  onClose,
  saveError,
}: ServerDialogProps) {
  const titleId = useId();
  const initialPreset: Preset = same(current, defaultChoice)
    ? 'default'
    : devMode && same(current, SERVER_LOCAL_CHOICE)
      ? 'local'
      : 'custom';
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [apiText, setApiText] = useState(initialPreset === 'custom' ? current.api : '');
  const [webText, setWebText] = useState(initialPreset === 'custom' ? current.web : '');
  const [check, setCheck] = useState<CheckState>({ status: 'idle' });
  const [askSaveAnyway, setAskSaveAnyway] = useState(false);
  const [saving, setSaving] = useState(false);

  const customApi = validate(apiText);
  const customWeb = validate(webText);
  let target: ServerDialogChoice | null = null;
  if (preset === 'default') target = defaultChoice;
  else if (preset === 'local') target = SERVER_LOCAL_CHOICE;
  else if (customApi.ok && customWeb.ok) target = { api: customApi.url, web: customWeb.url };

  const targetKey = target ? `${target.api}|${target.web}` : '';
  // A result belongs to the address it was made for.
  const result = check.status === 'ok' || check.status === 'failed' ? check : null;
  const currentResult = result && result.target === targetKey ? result : null;
  const unchanged = target !== null && same(target, current);

  // Anything the person changes cancels the pending question and the old result.
  useEffect(() => setAskSaveAnyway(false), [targetKey]);

  const runCheck = async () => {
    if (!target) return;
    const checked = target;
    const key = `${checked.api}|${checked.web}`;
    setCheck({ status: 'checking' });
    const outcome = await onCheck(checked.api).catch((): ServerDialogCheckResult => ({
      ok: false,
      cause: 'Không kiểm tra được kết nối.',
    }));
    setCheck(
      outcome.ok
        ? { status: 'ok', target: key }
        : { status: 'failed', target: key, cause: outcome.cause },
    );
  };

  const save = async () => {
    if (!target || unchanged || saving) return;
    setSaving(true);
    try {
      await onSave(target);
    } finally {
      setSaving(false);
    }
  };

  const onSaveClick = () => {
    if (currentResult?.status === 'failed' && !askSaveAnyway) {
      setAskSaveAnyway(true);
      return;
    }
    void save();
  };

  const options: { value: Preset; label: string; hint: string }[] = [
    { value: 'default', label: SERVER_PRESET_DEFAULT_LABEL, hint: hostOf(defaultChoice.api) },
    ...(devMode
      ? [{ value: 'local' as const, label: SERVER_PRESET_LOCAL_LABEL, hint: 'localhost:4000' }]
      : []),
    { value: 'custom', label: SERVER_PRESET_CUSTOM_LABEL, hint: 'Nhập địa chỉ https://' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-card text-card-foreground w-full max-w-md space-y-4 rounded-2xl border p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          Máy chủ
        </h2>

        <div role="radiogroup" aria-label="Chọn máy chủ" className="space-y-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                preset === option.value ? 'border-ring' : ''
              }`}
            >
              <input
                type="radio"
                name="server-preset"
                className="mt-1"
                checked={preset === option.value}
                onChange={() => setPreset(option.value)}
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="text-muted-foreground block text-xs">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {preset === 'custom' ? (
          <div className="space-y-3">
            <AddressField
              label="Địa chỉ API"
              placeholder="https://api.example.com"
              value={apiText}
              onChange={setApiText}
              error={apiText.trim() !== '' && !customApi.ok ? customApi.reason : null}
            />
            <AddressField
              label="Địa chỉ web"
              placeholder="https://app.example.com"
              value={webText}
              onChange={setWebText}
              error={webText.trim() !== '' && !customWeb.ok ? customWeb.reason : null}
            />
          </div>
        ) : null}

        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!target || check.status === 'checking'}
            onClick={() => void runCheck()}
          >
            {check.status === 'checking' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
          </Button>
          <p role="status" aria-live="polite" className="min-h-5 text-sm">
            {currentResult?.status === 'ok' ? (
              <span className="text-emerald-600 dark:text-emerald-400">Kết nối được.</span>
            ) : null}
            {currentResult?.status === 'failed' ? (
              <span className="text-red-600 dark:text-red-400">
                Không kết nối được. {currentResult.cause}
              </span>
            ) : null}
          </p>
        </div>

        {target && !unchanged ? (
          <div className="text-muted-foreground space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p>{serverWarningText(hostOf(target.api))}</p>
            <p>
              {signedIn ? `${SERVER_SIGNOUT_TEXT} ` : ''}
              {SERVER_RESTART_TEXT}
            </p>
          </div>
        ) : null}

        {askSaveAnyway ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {SERVER_CHECK_FAILED_CONFIRM_TEXT}
          </p>
        ) : null}
        {saveError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {saveError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {!same(current, defaultChoice) && preset !== 'default' ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreset('default')}>
              Đặt lại mặc định
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Huỷ
            </Button>
            <Button
              type="button"
              variant={askSaveAnyway ? 'destructive' : 'default'}
              disabled={!target || unchanged || saving}
              onClick={onSaveClick}
            >
              {askSaveAnyway ? 'Vẫn lưu' : signedIn ? 'Lưu và đăng xuất' : 'Lưu'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddressField({
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange(value: string): void;
  error: string | null;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
