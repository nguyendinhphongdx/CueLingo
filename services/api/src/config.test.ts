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
    expect(config.ADMIN_EMAILS).toEqual([]);
  });

  it('normalizes the admin email allowlist', () => {
    const config = loadConfig({
      ...valid,
      ADMIN_EMAILS: ' Owner@Example.com, second@example.com ',
    });
    expect(config.ADMIN_EMAILS).toEqual(['owner@example.com', 'second@example.com']);
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

  it('accepts valid optional realtime configuration', () => {
    const config = loadConfig({
      ...valid,
      GEMINI_API_KEY: 'gemini-key',
      REALTIME_DEV_TOKEN: 'dev-token-at-least-16-characters',
      REALTIME_DEV_USER_ID: '9ee72a14-8cd4-4f2e-8131-4ed638e2d875',
    });
    expect(config.GEMINI_API_KEY).toBe('gemini-key');
    expect(config.REALTIME_DEV_TOKEN).toBe('dev-token-at-least-16-characters');
    expect(config.REALTIME_DEV_USER_ID).toBe('9ee72a14-8cd4-4f2e-8131-4ed638e2d875');
  });

  it('rejects invalid realtime development credentials', () => {
    expect(() => loadConfig({ ...valid, REALTIME_DEV_TOKEN: 'too-short' })).toThrow(
      /REALTIME_DEV_TOKEN/,
    );
    expect(() => loadConfig({ ...valid, REALTIME_DEV_USER_ID: 'not-a-uuid' })).toThrow(
      /REALTIME_DEV_USER_ID/,
    );
  });
});

describe('INVITES_REQUIRED', () => {
  it('is off in development and test, on in production', () => {
    expect(loadConfig({ ...valid }).INVITES_REQUIRED).toBe(false);
    expect(loadConfig({ ...valid, NODE_ENV: 'test' }).INVITES_REQUIRED).toBe(false);
    expect(
      loadConfig({
        ...valid,
        NODE_ENV: 'production',
        MAIL_PROVIDER: 'smtp',
        SMTP_URL: 'smtp://localhost',
        MAIL_FROM: 'CueLingo <a@b.co>',
      }).INVITES_REQUIRED,
    ).toBe(true);
  });

  it('can be switched either way', () => {
    expect(loadConfig({ ...valid, INVITES_REQUIRED: 'true' }).INVITES_REQUIRED).toBe(true);
    expect(
      loadConfig({
        ...valid,
        NODE_ENV: 'production',
        MAIL_PROVIDER: 'smtp',
        SMTP_URL: 'smtp://localhost',
        MAIL_FROM: 'CueLingo <a@b.co>',
        INVITES_REQUIRED: 'false',
      }).INVITES_REQUIRED,
    ).toBe(false);
  });

  it('defaults the assistant to on with the planned daily allowance, and reads overrides', () => {
    const defaults = loadConfig(valid);
    expect(defaults.AGENT_ENABLED).toBe(true);
    expect(defaults.AGENT_HTML_BLOCKS).toBe(false);
    expect(defaults.AGENT_QUOTA_TURNS_PER_DAY).toBe(60);
    expect(defaults.AGENT_QUOTA_TOKENS_PER_DAY).toBe(400_000);
    expect(defaults.AGENT_QUOTA_USD_PER_DAY).toBe(0.25);

    const custom = loadConfig({
      ...valid,
      AGENT_ENABLED: 'false',
      AGENT_HTML_BLOCKS: 'true',
      AGENT_QUOTA_TURNS_PER_DAY: '10',
      AGENT_QUOTA_USD_PER_DAY: '1.5',
    });
    expect(custom.AGENT_ENABLED).toBe(false);
    expect(custom.AGENT_HTML_BLOCKS).toBe(true);
    expect(custom.AGENT_QUOTA_TURNS_PER_DAY).toBe(10);
    expect(custom.AGENT_QUOTA_USD_PER_DAY).toBe(1.5);
    expect(() => loadConfig({ ...valid, AGENT_ENABLED: 'maybe' })).toThrow(/AGENT_ENABLED/);
  });
});
