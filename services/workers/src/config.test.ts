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
});
