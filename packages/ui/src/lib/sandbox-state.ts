import type { StallReason } from './sandbox-watchdog';

/** Why a block is no longer shown: the watchdog, or the page itself reported an error / a blocked action. */
export type StopReason = StallReason | 'error' | 'refused' | 'unavailable';

export interface SandboxState {
  phase: 'loading' | 'running' | 'stopped';
  reason?: StopReason;
  /** Height of the frame in CSS pixels, as the page asked. */
  height: number;
  showSource: boolean;
}

export type SandboxEvent =
  | { type: 'ready' }
  | { type: 'resize'; height: number }
  | { type: 'stopped'; reason: StopReason }
  | { type: 'toggleSource' };

export const INITIAL_BLOCK_HEIGHT = 160;

export const initialSandboxState = (unavailable = false): SandboxState =>
  unavailable
    ? { phase: 'stopped', reason: 'unavailable', height: INITIAL_BLOCK_HEIGHT, showSource: false }
    : { phase: 'loading', height: INITIAL_BLOCK_HEIGHT, showSource: false };

/** A stopped block stays stopped: late messages from a removed frame change nothing. */
export function sandboxReducer(state: SandboxState, event: SandboxEvent): SandboxState {
  if (event.type === 'toggleSource') return { ...state, showSource: !state.showSource };
  if (state.phase === 'stopped') return state;
  switch (event.type) {
    case 'ready':
      return { ...state, phase: 'running' };
    case 'resize':
      return { ...state, height: event.height };
    case 'stopped':
      return { ...state, phase: 'stopped', reason: event.reason };
  }
}

const REASONS: Record<StopReason, string> = {
  no_ready: 'Khối không khởi động kịp.',
  no_pong: 'Khối ngừng phản hồi.',
  error: 'Khối báo lỗi hoặc cố làm điều không được phép.',
  refused: 'Khối cứ xin lưu hoặc đọc dữ liệu dù bạn đã từ chối.',
  unavailable: 'Chưa có nơi chạy khối giao diện.',
};

export const stopReasonText = (reason: StopReason | undefined): string =>
  reason ? REASONS[reason] : '';
