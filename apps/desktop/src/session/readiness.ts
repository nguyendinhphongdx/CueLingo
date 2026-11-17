import { SUPPORTED_LANGUAGES, isLanguageCode, type LanguageCode } from '@cuelingo/shared';
import type { Status } from '@cuelingo/ui/components/status-row';
import { PRIVACY_PANES, type AudioModelEvent, type PermissionsStatus } from '../lib/native';
import type { SystemAudioCheck } from '../lib/native';
import { currentOs, privacyPanes, type DesktopOs } from '../lib/platform';
import { formatSize, type ModelView } from '../models/model-state';

type ModelEvent = Extract<AudioModelEvent, { type: 'model' }>;

export type ReadinessId = 'microphone' | 'systemAudio' | 'model';

/** What a fix button does: open a system settings page, play the test sound, download the model, or start again. */
export type ReadinessFix =
  | { kind: 'pane'; label: string; pane: string }
  | { kind: 'test-audio'; label: string }
  | { kind: 'download-model'; label: string }
  | { kind: 'retry'; label: string };

export interface ReadinessItem {
  id: ReadinessId;
  status: Status;
  title: string;
  detail?: string;
  fix?: ReadinessFix;
}

export interface ReadinessInput {
  /** Null while it is still being read. */
  permissions: PermissionsStatus | null;
  /** The result of the "thử nghe" test, if one was run. */
  systemCheck: SystemAudioCheck | 'checking' | null;
  model: ModelEvent | null;
  /** The state of this language's model from the model manager; null/absent when the app cannot manage models. */
  modelView?: ModelView | null;
  language: LanguageCode;
  os?: DesktopOs;
}

function microphone(permissions: PermissionsStatus | null, os: DesktopOs): ReadinessItem {
  const title = 'Micro';
  const pane = os === 'windows' ? privacyPanes(os).microphone : PRIVACY_PANES.microphone;
  const settings = os === 'windows' ? 'Mở Cài đặt Windows' : 'Mở Cài đặt hệ thống';
  if (!permissions) return { id: 'microphone', status: 'pending', title };
  switch (permissions.microphone) {
    case 'granted':
      return { id: 'microphone', status: 'ok', title };
    case 'denied':
      return {
        id: 'microphone',
        status: 'error',
        title: 'Micro chưa được cấp quyền',
        detail: `${os === 'windows' ? 'Windows' : 'macOS'} đã chặn micro cho CueLingo. Caption từ âm thanh hệ thống vẫn chạy.`,
        fix: { kind: 'pane', label: settings, pane },
      };
    default:
      return {
        id: 'microphone',
        status: 'warn',
        title,
        detail:
          os === 'windows'
            ? 'Chưa xác định quyền. Hãy bấm Bắt đầu họp để thử.'
            : 'Chưa cấp quyền. macOS sẽ hỏi khi bạn bấm Bắt đầu họp lần đầu.',
      };
  }
}

function systemAudio(input: ReadinessInput, os: DesktopOs): ReadinessItem {
  const title = 'Âm thanh hệ thống';
  // Windows has no permission for what the speakers play, so there is nothing to fix.
  if (os === 'windows') {
    return { id: 'systemAudio', status: 'ok', title, detail: 'Không cần cấp quyền.' };
  }
  const pane = PRIVACY_PANES.systemAudio;
  const settings = { kind: 'pane', label: 'Mở Cài đặt hệ thống', pane } as const;
  const { permissions, systemCheck } = input;
  if (systemCheck === 'checking') {
    return {
      id: 'systemAudio',
      status: 'pending',
      title,
      detail: 'Đang phát một tiếng chuông ngắn…',
    };
  }
  if (systemCheck === 'silent') {
    return {
      id: 'systemAudio',
      status: 'error',
      title,
      detail: 'Không nghe thấy âm thanh. Hãy bật CueLingo trong mục Ghi âm thanh hệ thống.',
      fix: settings,
    };
  }
  if (systemCheck === 'granted' || (!systemCheck && permissions?.systemAudio === 'granted')) {
    return { id: 'systemAudio', status: 'ok', title };
  }
  if (systemCheck === 'error' || permissions?.systemAudio === 'denied') {
    return {
      id: 'systemAudio',
      status: 'error',
      title,
      detail: 'macOS đã chặn ghi âm thanh hệ thống cho CueLingo.',
      fix: settings,
    };
  }
  // macOS does not say in advance whether this permission is given; only the test sound can tell.
  return {
    id: 'systemAudio',
    status: permissions ? 'warn' : 'pending',
    title,
    detail: 'macOS không báo trước quyền này. Thử nghe để kiểm tra.',
    fix: { kind: 'test-audio', label: 'Thử nghe âm thanh' },
  };
}

function model(input: ReadinessInput): ReadinessItem {
  const { language, model: event } = input;
  const info = SUPPORTED_LANGUAGES[language];
  if (info.recognition === 'cloud') {
    return {
      id: 'model',
      status: 'ok',
      title: `Nhận dạng ${info.name.toLowerCase()} bằng đám mây`,
      detail: 'Âm thanh được gửi tới Google khi họp, sau khi bạn đồng ý.',
    };
  }
  const title = `Mô hình nhận dạng ${info.name.toLowerCase()}`;
  const managed = input.modelView;
  if (managed?.kind === 'missing') {
    return {
      id: 'model',
      status: 'warn',
      title,
      detail: `Chưa tải (${formatSize(managed.sizeBytes)}). Caption sẽ chờ mô hình tải xong khi bạn bắt đầu họp.`,
      fix: { kind: 'download-model', label: 'Tải ngay' },
    };
  }
  if (managed?.kind === 'downloading') {
    return {
      id: 'model',
      status: 'warn',
      title,
      detail: `Đang tải ${Math.round(managed.progress * 100)}%`,
    };
  }
  if (managed?.kind === 'error') {
    return {
      id: 'model',
      status: 'error',
      title,
      detail: managed.message,
      fix: { kind: 'download-model', label: 'Thử lại' },
    };
  }
  if (managed?.kind === 'ready') {
    return { id: 'model', status: 'ok', title, detail: 'Đã có trên máy.' };
  }
  const forThisLanguage = event && isLanguageCode(event.language) && event.language === language;
  if (forThisLanguage && event.state === 'downloading') {
    return {
      id: 'model',
      status: 'warn',
      title,
      detail: `Đang tải ${Math.round((event.progress ?? 0) * 100)}%`,
    };
  }
  if (forThisLanguage && event.state === 'error') {
    return {
      id: 'model',
      status: 'error',
      title,
      detail: 'Không tải được mô hình. Kiểm tra mạng rồi bắt đầu lại.',
      fix: { kind: 'retry', label: 'Bắt đầu lại để tải model' },
    };
  }
  return {
    id: 'model',
    status: 'ok',
    title,
    detail: forThisLanguage ? undefined : 'Tự tải về lần đầu nếu máy chưa có.',
  };
}

/** The three things a meeting needs, in the order the person fixes them. */
export function describeReadiness(input: ReadinessInput): ReadinessItem[] {
  const os = input.os ?? currentOs();
  return [microphone(input.permissions, os), systemAudio(input, os), model(input)];
}

/** The start button says so when it will run without the microphone; it is never disabled for that. */
export const startLabel = (items: readonly ReadinessItem[]): string =>
  items.some((item) => item.id === 'microphone' && item.status === 'error')
    ? 'Bắt đầu họp, không dùng micro'
    : 'Bắt đầu họp';
