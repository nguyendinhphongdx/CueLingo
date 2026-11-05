import { INVITE_INVALID_AUTH_ERROR } from '@cuelingo/shared';

/** Shown for every invite refusal; it never says whether the code was wrong, used up or expired. */
export const INVITE_ERROR_MESSAGE = 'Mã mời không dùng được. Kiểm tra lại mã hoặc xin mã mới.';

/** `error=invite_invalid` is what Better Auth appends when it refuses to create an account. */
export const inviteErrorFromUrl = (search: string): string | null =>
  new URLSearchParams(search).get('error') === INVITE_INVALID_AUTH_ERROR
    ? INVITE_ERROR_MESSAGE
    : null;
