import { SUPPORTED_LANGUAGES, type LanguageCode } from '@cuelingo/shared';
import type { AudioModelEvent } from './native';

/** What the person is told before the on-device speech model is downloaded. */
export const MODEL_SIZE_HINT = 'khoảng 600 MB';

export type SpeechModelState =
  'unknown' | 'missing' | 'cached' | 'downloading' | 'compiling' | 'ready' | 'error' | 'cloud';

/** Whether a language has a model to download here, or is recognised in the cloud and needs nothing. */
export function modelStepPlan(language: LanguageCode): 'download' | 'cloud' {
  return SUPPORTED_LANGUAGES[language].recognition === 'cloud' ? 'cloud' : 'download';
}

/** `status` is what the sidecar says about files on disk (`stt_model_status`); null until it answered. */
export type ModelDiskStatus = 'cached' | 'missing' | 'ready' | 'unknown' | null;

type ModelEvent = Extract<AudioModelEvent, { type: 'model' }>;

/**
 * The one place that turns "files on disk", "compiled for this app version" and the latest native event into what
 * the screen shows. A running download or an error always wins over what is on disk.
 */
export function modelState(input: {
  language: LanguageCode;
  status: ModelDiskStatus;
  /** The model was compiled by this app version on this machine (see `isCompiled`). */
  compiled: boolean;
  event: ModelEvent | null;
}): SpeechModelState {
  const { language, status, compiled, event } = input;
  if (modelStepPlan(language) === 'cloud') return 'cloud';
  if (event && event.language === language) {
    if (event.state === 'downloading')
      return (event.progress ?? 0) >= 1 ? 'compiling' : 'downloading';
    if (event.state === 'ready') return 'ready';
    return 'error';
  }
  if (status === null) return 'unknown';
  if (status === 'missing') return 'missing';
  if (status === 'unknown') return 'unknown';
  // Files are there. Windows reports `ready` (nothing to compile); macOS compiles per app build (about 40 s).
  return status === 'ready' || compiled ? 'ready' : 'cached';
}

const COMPILED_KEY = 'cuelingo.stt-compiled';

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const stored = (): KeyValueStore | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const compiledKey = (version: string, language: LanguageCode) => `${version}:${language}`;

/** Whether this app version already compiled the model for `language` on this machine. */
export function isCompiled(
  version: string,
  language: LanguageCode,
  store: KeyValueStore | null = stored(),
): boolean {
  try {
    return (store?.getItem(COMPILED_KEY) ?? '').split(',').includes(compiledKey(version, language));
  } catch {
    return false;
  }
}

/** Remembers that the model was compiled (set when the native side reports `ready`). Old versions drop out. */
export function markCompiled(
  version: string,
  language: LanguageCode,
  store: KeyValueStore | null = stored(),
): void {
  try {
    const current = (store?.getItem(COMPILED_KEY) ?? '')
      .split(',')
      .filter(
        (entry) => entry.startsWith(`${version}:`) && entry !== compiledKey(version, language),
      );
    store?.setItem(COMPILED_KEY, [...current, compiledKey(version, language)].join(','));
  } catch {
    // Storage may be blocked; the screen then offers "Chuẩn bị" once more, which is harmless.
  }
}
