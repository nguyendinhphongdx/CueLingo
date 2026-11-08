import { describe, expect, it } from 'vitest';
import { CONNECTION_ERROR_MESSAGE } from '../../lib/errors';
import { loginErrorMessage } from './login-error';

describe('loginErrorMessage', () => {
  it('says the server cannot be reached when the browser could not send the request', () => {
    expect(loginErrorMessage(new TypeError('Failed to fetch'))).toBe(CONNECTION_ERROR_MESSAGE);
    expect(loginErrorMessage(new TypeError('Load failed'))).toBe(CONNECTION_ERROR_MESSAGE);
  });

  it('keeps our own Vietnamese messages and shows nothing without an error', () => {
    expect(loginErrorMessage(new Error('Không gửi được liên kết đăng nhập'))).toBe(
      'Không gửi được liên kết đăng nhập',
    );
    expect(loginErrorMessage(null)).toBeNull();
    expect(loginErrorMessage(undefined)).toBeNull();
  });
});
