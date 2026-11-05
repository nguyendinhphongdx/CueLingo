import { describe, expect, it } from 'vitest';
import { INVITE_ERROR_MESSAGE, inviteErrorFromUrl } from './invite-error';

describe('inviteErrorFromUrl', () => {
  it('turns the refusal Better Auth appends into one fixed message', () => {
    expect(inviteErrorFromUrl('?error=invite_invalid')).toBe(INVITE_ERROR_MESSAGE);
    expect(inviteErrorFromUrl('?app=1&error=invite_invalid')).toBe(INVITE_ERROR_MESSAGE);
  });

  it('says nothing for other URLs and other errors', () => {
    expect(inviteErrorFromUrl('')).toBeNull();
    expect(inviteErrorFromUrl('?app=1')).toBeNull();
    expect(inviteErrorFromUrl('?error=access_denied')).toBeNull();
  });
});
