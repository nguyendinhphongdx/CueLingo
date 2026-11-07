import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) vi.stubEnv(name, undefined as never);
    else vi.stubEnv(name, value);
  }
  return import('./config');
}

describe('web config: interactive blocks', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off by default', async () => {
    const config = await load({
      NEXT_PUBLIC_AGENT_HTML_BLOCKS: undefined,
      NEXT_PUBLIC_SANDBOX_ORIGIN: undefined,
    });
    expect(config.HTML_BLOCKS_ENABLED).toBe(false);
    expect(config.SANDBOX_ORIGIN).toBeNull();
  });

  it('needs both the flag and a runner origin', async () => {
    expect(
      (await load({ NEXT_PUBLIC_AGENT_HTML_BLOCKS: 'true', NEXT_PUBLIC_SANDBOX_ORIGIN: undefined }))
        .HTML_BLOCKS_ENABLED,
    ).toBe(false);
    expect(
      (
        await load({
          NEXT_PUBLIC_AGENT_HTML_BLOCKS: 'false',
          NEXT_PUBLIC_SANDBOX_ORIGIN: 'http://localhost:3101',
        })
      ).HTML_BLOCKS_ENABLED,
    ).toBe(false);
    const on = await load({
      NEXT_PUBLIC_AGENT_HTML_BLOCKS: 'true',
      NEXT_PUBLIC_SANDBOX_ORIGIN: 'http://localhost:3101',
    });
    expect(on.HTML_BLOCKS_ENABLED).toBe(true);
    expect(on.SANDBOX_ORIGIN).toBe('http://localhost:3101');
  });

  it('refuses a runner origin that is not http(s)', async () => {
    const config = await load({
      NEXT_PUBLIC_AGENT_HTML_BLOCKS: 'true',
      NEXT_PUBLIC_SANDBOX_ORIGIN: 'javascript:alert(1)',
    });
    expect(config.HTML_BLOCKS_ENABLED).toBe(false);
    expect(config.SANDBOX_ORIGIN).toBeNull();
  });

  it('refuses a runner on the same origin as the API, and switches the feature off', async () => {
    const config = await load({
      NEXT_PUBLIC_AGENT_HTML_BLOCKS: 'true',
      NEXT_PUBLIC_API_URL: 'http://localhost:3101/v1',
      NEXT_PUBLIC_SANDBOX_ORIGIN: 'http://localhost:3101',
    });
    expect(config.SANDBOX_ORIGIN).toBeNull();
    expect(config.HTML_BLOCKS_ENABLED).toBe(false);
  });
});
