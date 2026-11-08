import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultServer,
  resetServer,
  saveServer,
  SERVER_STORAGE_KEY,
  serverConfig,
  validateServerUrl,
} from './server-config';

class MemoryStore {
  data = new Map<string, string>();
  getItem = (key: string) => this.data.get(key) ?? null;
  setItem = (key: string, value: string) => void this.data.set(key, value);
  removeItem = (key: string) => void this.data.delete(key);
}

let storage: MemoryStore;
beforeEach(() => {
  storage = new MemoryStore();
});
const env = (extra = {}) => ({
  dev: false,
  buildApi: 'ws://build.example:4000/',
  buildWeb: 'https://web.build.example/',
  storage,
  ...extra,
});

describe('serverConfig (AC1)', () => {
  it('uses the build values when nothing is saved, and turns ws into http for REST', () => {
    expect(serverConfig(env())).toEqual({
      apiUrl: 'http://build.example:4000',
      wsUrl: 'ws://build.example:4000',
      webUrl: 'https://web.build.example',
      custom: false,
    });
  });

  it('prefers what the person saved over the build values', () => {
    saveServer({ api: 'https://api.beta.example/', web: 'https://beta.example' }, env());
    expect(serverConfig(env())).toEqual({
      apiUrl: 'https://api.beta.example',
      wsUrl: 'wss://api.beta.example',
      webUrl: 'https://beta.example',
      custom: true,
    });
  });

  it('falls back to the local default when the build has no values', () => {
    expect(serverConfig({ dev: false, buildApi: '', buildWeb: '', storage })).toMatchObject({
      apiUrl: 'http://localhost:4000',
      webUrl: 'http://localhost:3000',
    });
  });

  it('ignores a saved value that is damaged or no longer acceptable', () => {
    storage.setItem(SERVER_STORAGE_KEY, 'not json');
    expect(serverConfig(env()).custom).toBe(false);
    storage.setItem(
      SERVER_STORAGE_KEY,
      JSON.stringify({ api: 'http://evil.example', web: 'https://a.example' }),
    );
    expect(serverConfig(env()).custom).toBe(false);
    // A localhost choice saved by a dev build does not carry into a release build.
    storage.setItem(
      SERVER_STORAGE_KEY,
      JSON.stringify({ api: 'http://localhost:4001', web: 'http://localhost:3001' }),
    );
    expect(serverConfig(env({ dev: true })).custom).toBe(true);
    expect(serverConfig(env({ dev: false })).custom).toBe(false);
  });
});

describe('validateServerUrl (AC5)', () => {
  const cases: [string, boolean, string | null][] = [
    ['https://api.example.com', false, 'https://api.example.com'],
    ['  https://api.example.com/  ', false, 'https://api.example.com'],
    ['https://api.example.com:8443/base/', false, 'https://api.example.com:8443/base'],
    ['http://api.example.com', false, null],
    ['http://api.example.com', true, null],
    ['http://localhost:4000', false, null],
    ['http://localhost:4000', true, 'http://localhost:4000'],
    ['http://127.0.0.1:4000', true, 'http://127.0.0.1:4000'],
    ['ftp://api.example.com', true, null],
    ['ws://localhost:4000', true, null],
    ['javascript:alert(1)', true, null],
    ['api.example.com', false, null],
    ['https://user:pw@api.example.com', false, null],
    ['https://api.example.com/?x=1', false, null],
    ['', false, null],
  ];
  it.each(cases)('%s (dev=%s)', (input, dev, expected) => {
    const result = validateServerUrl(input, { dev });
    if (expected === null) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/\S/);
    } else {
      expect(result).toEqual({ ok: true, url: expected });
    }
  });

  it('refuses to save an unacceptable address', () => {
    expect(() =>
      saveServer({ api: 'http://evil.example', web: 'https://a.example' }, env()),
    ).toThrow();
    expect(storage.data.size).toBe(0);
  });
});

describe('resetServer (AC10) and storage (AC11)', () => {
  it('goes back to the build address', () => {
    saveServer({ api: 'https://api.beta.example', web: 'https://beta.example' }, env());
    resetServer(env());
    expect(serverConfig(env()).apiUrl).toBe(defaultServer(env()).api);
    expect(serverConfig(env()).custom).toBe(false);
  });

  it('keeps the choice in the next read (a restart or an update) and only on this device', () => {
    saveServer({ api: 'https://api.beta.example', web: 'https://beta.example' }, env());
    expect(storage.data.get(SERVER_STORAGE_KEY)).toBe(
      JSON.stringify({ api: 'https://api.beta.example', web: 'https://beta.example' }),
    );
    expect(serverConfig(env()).apiUrl).toBe('https://api.beta.example');
  });

  it('answers with the build address when storage is unavailable', () => {
    const denied = () => {
      throw new Error('denied');
    };
    const broken = { getItem: denied, setItem: denied, removeItem: denied };
    expect(serverConfig(env({ storage: broken })).custom).toBe(false);
    expect(() => resetServer(env({ storage: broken }))).not.toThrow();
  });
});
