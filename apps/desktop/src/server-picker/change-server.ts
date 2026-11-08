import type { ServerChoice } from '../server';

export const MEETING_BLOCK_TEXT = 'Đang họp. Hãy dừng cuộc họp trước khi đổi máy chủ.';
export const SAVE_FAILED_TEXT = 'Không lưu được lựa chọn. Hãy đóng và mở lại CueLingo rồi thử lại.';

export interface ChangeServerDeps {
  /** True while a meeting (caption session) is anything but idle. */
  meetingActive(): boolean;
  /** The device token of the signed-in person, or null. */
  token(): string | null;
  /** Asks the CURRENT server to forget this device. Best effort. */
  revoke(token: string): Promise<void>;
  /** Removes the token from the Keychain. */
  clearToken(): Promise<void>;
  /** Writes the new choice (or removes the saved one when it is the built-in server). Throws when it cannot. */
  persist(choice: ServerChoice): void;
  relaunch(): Promise<void>;
}

export type ChangeServerResult =
  | { status: 'blocked'; reason: string }
  | { status: 'relaunching' }
  /** Saved, but the app could not restart itself: ask the person to reopen it. */
  | { status: 'reopen' }
  | { status: 'failed'; reason: string };

/**
 * Switches the server: forget this device on the old server, drop the token, save the choice, restart.
 * The order matters: the old server must be reached before the new address is saved, and the token must
 * be gone before the app can ever talk to the new one (AC8).
 */
export async function changeServer(
  choice: ServerChoice,
  deps: ChangeServerDeps,
): Promise<ChangeServerResult> {
  if (deps.meetingActive()) return { status: 'blocked', reason: MEETING_BLOCK_TEXT };

  const token = deps.token();
  if (token) await deps.revoke(token).catch(() => undefined);
  await deps.clearToken().catch(() => undefined);

  try {
    deps.persist(choice);
  } catch {
    return { status: 'failed', reason: SAVE_FAILED_TEXT };
  }

  try {
    await deps.relaunch();
    return { status: 'relaunching' };
  } catch {
    return { status: 'reopen' };
  }
}
