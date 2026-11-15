import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config';

describe('worker loadConfig', () => {
  it('parses a valid environment', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://u:p@localhost:5432/d' }).NODE_ENV).toBe(
      'development',
    );
  });

  it('names the missing variable', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('accepts an optional Gemini API key', () => {
    expect(
      loadConfig({ DATABASE_URL: 'postgres://u:p@localhost:5432/d', GEMINI_API_KEY: 'key' })
        .GEMINI_API_KEY,
    ).toBe('key');
  });

  it('reads PLAN_LIMITS and ADMIN_EMAILS the way the API does', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://u:p@localhost:5432/d',
      PLAN_LIMITS: '{"free":{"debriefs":2}}',
      ADMIN_EMAILS: ' Owner@Example.com ',
    });
    expect(config.PLAN_LIMITS.free.debriefs).toBe(2);
    expect(config.PLAN_LIMITS.free.assist_daily).toBe(20);
    expect(config.ADMIN_EMAILS).toEqual(['owner@example.com']);
    expect(() =>
      loadConfig({ DATABASE_URL: 'postgres://u:p@localhost:5432/d', PLAN_LIMITS: '{oops' }),
    ).toThrow(/PLAN_LIMITS/);
  });
});
