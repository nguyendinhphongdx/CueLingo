import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

const valid = {
  DATABASE_URL: 'postgres://cuelingo:cuelingo@localhost:5432/cuelingo',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('parses a valid environment and applies defaults', () => {
    const config = loadConfig({ ...valid, PORT: '4100' });
    expect(config.PORT).toBe(4100);
    expect(config.NODE_ENV).toBe('development');
    expect(config.WEB_ORIGIN).toBe('http://localhost:3000');
  });

  it('names the missing variable', () => {
    expect(() => loadConfig({ BETTER_AUTH_SECRET: valid.BETTER_AUTH_SECRET })).toThrow(ConfigError);
    expect(() => loadConfig({ BETTER_AUTH_SECRET: valid.BETTER_AUTH_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a weak auth secret', () => {
    expect(() => loadConfig({ ...valid, BETTER_AUTH_SECRET: 'short' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it('treats an empty variable as unset', () => {
    const config = loadConfig({ ...valid, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
    expect(config.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('requires the Google credentials as a pair', () => {
    expect(() => loadConfig({ ...valid, GOOGLE_CLIENT_ID: 'id' })).toThrow(/GOOGLE_CLIENT_ID/);
    expect(
      loadConfig({ ...valid, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' }).GOOGLE_CLIENT_ID,
    ).toBe('id');
  });
});
