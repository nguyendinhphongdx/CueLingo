import { SUPPORTED_LANGUAGES, isLanguageCode, type LanguageCode } from '@cuelingo/shared';
import type { ModelStatus } from '../lib/native';

/** What the native side last said about one language's model while it was downloading. */
export interface Transient {
  state: 'downloading' | 'ready' | 'error';
  progress?: number;
  message?: string;
}

/** What a screen shows for one language. */
export type ModelView =
  | { kind: 'cloud' }
  | { kind: 'checking' }
  | { kind: 'ready'; sizeBytes: number }
  | { kind: 'missing'; sizeBytes: number }
  | { kind: 'downloading'; sizeBytes: number; progress: number }
  | { kind: 'error'; sizeBytes: number; message: string };

/** One `model` event from the sidecar, as far as this module cares. */
export interface ModelEventLike {
  language: string;
  state: 'downloading' | 'ready' | 'error';
  progress?: number;
  message?: string;
}

/** The next transient state after an event: it is just the event, kept per language by the store. */
export function transientOf(event: ModelEventLike): Transient {
  return { state: event.state, progress: event.progress, message: event.message };
}

/** The `error` event a cancelled download ends with: the person asked for it, so it is not a failure. */
export const CANCELLED = 'cancelled';

/** The per-language state after an event; a cancelled download goes back to what is on disk. */
export function applyModelEvent(
  current: Record<string, Transient>,
  event: ModelEventLike,
): Record<string, Transient> {
  if (event.state === 'error' && event.message === CANCELLED) {
    return Object.fromEntries(Object.entries(current).filter(([code]) => code !== event.language));
  }
  return { ...current, [event.language]: transientOf(event) };
}

/** Fixed Vietnamese text for a failed download; the sidecar's own message never reaches the screen. */
export function describeDownloadError(message?: string): string {
  const text = (message ?? '').toLowerCase();
  if (/sha|hash|checksum|size/.test(text)) {
    return 'Tệp tải về bị hỏng. Hãy thử tải lại.';
  }
  if (text.includes('interrupted')) {
    return 'Việc tải bị gián đoạn. Hãy thử tải lại.';
  }
  return 'Không tải được mô hình. Kiểm tra kết nối mạng rồi thử lại.';
}

/**
 * The view for `language`, or `null` when this build cannot manage models from the app (`status` is null):
 * the screens then keep the old flow, where the model comes down with the first meeting.
 * `status` is `undefined` while the first answer is still on its way.
 */
export function viewOf(
  language: string,
  status: ModelStatus | null | undefined,
  transient?: Transient,
): ModelView | null {
  if (isLanguageCode(language) && SUPPORTED_LANGUAGES[language].recognition === 'cloud') {
    return { kind: 'cloud' };
  }
  if (status === null) return null;
  const entry = status?.models.find((model) => model.language === language);
  const sizeBytes = entry?.sizeBytes ?? 0;
  if (transient?.state === 'downloading') {
    return { kind: 'downloading', sizeBytes, progress: transient.progress ?? 0 };
  }
  if (transient?.state === 'error') {
    return { kind: 'error', sizeBytes, message: describeDownloadError(transient.message) };
  }
  if (transient?.state === 'ready') return { kind: 'ready', sizeBytes };
  if (!entry) return { kind: 'checking' };
  return { kind: entry.state, sizeBytes };
}

/** `661288526` -> `631 MB`: whole megabytes (1 MB = 2^20 bytes, like the file manager), `GB` from 1024 MB. */
export function formatSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace('.', ',')} GB`;
  return `${Math.max(1, Math.round(mb))} MB`;
}

/** Whether the person may go on: the model is in place, or this build does not manage models at all. */
export function canContinue(view: ModelView | null): boolean {
  return view === null || view.kind === 'ready' || view.kind === 'cloud';
}

/**
 * What starting a meeting does about the model: go on, begin the download (once, because the person pressed
 * Start), or wait (a download is running, the status is being read, or it failed and they decide).
 */
export function gateAction(
  view: ModelView | null,
  alreadyStarted: boolean,
): 'begin' | 'download' | 'wait' {
  if (canContinue(view)) return 'begin';
  return view?.kind === 'missing' && !alreadyStarted ? 'download' : 'wait';
}

/** The on-device languages in the registry order, as `LanguageCode`s. */
export function deviceLanguages(): LanguageCode[] {
  return (Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]).filter(
    (code) => SUPPORTED_LANGUAGES[code].recognition === 'device',
  );
}
