/** Where the API and the web app are: one place that answers, so no module reads the build variables itself. */

export const SERVER_STORAGE_KEY = 'cuelingo.server.v1';

const DEFAULT_API = 'http://localhost:4000';
const DEFAULT_WEB = 'http://localhost:3000';

export interface ServerConfig {
  /** Base of the REST API, `http(s)://…` without a trailing slash. */
  apiUrl: string;
  /** Base of the realtime API, `ws(s)://…` without a trailing slash. */
  wsUrl: string;
  /** Base of the web app, `http(s)://…` without a trailing slash. */
  webUrl: string;
  /** True when the person chose this server instead of the one built into the app. */
  custom: boolean;
}

export interface ServerChoice {
  api: string;
  web: string;
}

type ServerStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface ServerEnv {
  /** Development build: allows `http://localhost`. */
  dev: boolean;
  buildApi?: string;
  buildWeb?: string;
  storage?: ServerStorage;
}

export type UrlCheck = { ok: true; url: string } | { ok: false; reason: string };

const LOOPBACK = new Set(['localhost', '127.0.0.1']);

function currentEnv(): Required<Pick<ServerEnv, 'dev' | 'buildApi' | 'buildWeb'>> {
  return {
    dev: import.meta.env.DEV === true,
    buildApi: import.meta.env.VITE_API_URL || DEFAULT_API,
    buildWeb: import.meta.env.VITE_WEB_URL || DEFAULT_WEB,
  };
}

function storageOf(env: ServerEnv): ServerStorage | null {
  try {
    return env.storage ?? globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** `ws:`/`wss:` to `http:`/`https:`, no trailing slash. */
function toHttp(url: string): string {
  return url.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:').replace(/\/+$/, '');
}

const toWs = (httpUrl: string): string =>
  httpUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');

/** Accepts only `https://`, plus `http://localhost` or `127.0.0.1` in a development build. */
export function validateServerUrl(input: string, env: Pick<ServerEnv, 'dev'>): UrlCheck {
  const text = input.trim();
  if (text === '') return { ok: false, reason: 'Hãy nhập địa chỉ máy chủ.' };
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, reason: 'Địa chỉ không hợp lệ. Ví dụ: https://may-chu.example.com' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'Chỉ chấp nhận địa chỉ bắt đầu bằng https://.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Địa chỉ không được chứa tên người dùng hoặc mật khẩu.' };
  }
  if (parsed.search || parsed.hash) {
    return { ok: false, reason: 'Địa chỉ không được chứa tham số hoặc dấu #.' };
  }
  if (parsed.protocol === 'http:') {
    if (!LOOPBACK.has(parsed.hostname)) {
      return { ok: false, reason: 'Chỉ chấp nhận địa chỉ bắt đầu bằng https://.' };
    }
    if (!env.dev) {
      return {
        ok: false,
        reason: 'Địa chỉ http://localhost chỉ dùng được ở bản dành cho lập trình.',
      };
    }
  }
  return { ok: true, url: toHttp(`${parsed.origin}${parsed.pathname}`) };
}

function readSaved(env: ServerEnv): ServerChoice | null {
  const storage = storageOf(env);
  if (!storage) return null;
  try {
    const raw = storage.getItem(SERVER_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ServerChoice>;
    const api = validateServerUrl(String(value.api ?? ''), env);
    const web = validateServerUrl(String(value.web ?? ''), env);
    return api.ok && web.ok ? { api: api.url, web: web.url } : null;
  } catch {
    return null;
  }
}

function build(env: Required<Pick<ServerEnv, 'buildApi' | 'buildWeb'>>): ServerChoice {
  return { api: toHttp(env.buildApi || DEFAULT_API), web: toHttp(env.buildWeb || DEFAULT_WEB) };
}

/** The server in use: what the person saved, else what was built into the app, else the local default. */
export function serverConfig(overrides: Partial<ServerEnv> = {}): ServerConfig {
  const env = { ...currentEnv(), ...overrides };
  const saved = readSaved(env);
  const choice = saved ?? build(env);
  return {
    apiUrl: choice.api,
    wsUrl: toWs(choice.api),
    webUrl: choice.web,
    custom: saved !== null,
  };
}

/** The server built into the app, ignoring any saved choice. */
export function defaultServer(overrides: Partial<ServerEnv> = {}): ServerChoice {
  return build({ ...currentEnv(), ...overrides });
}

/** Saves a validated choice on this device only. Throws when an address is not acceptable. */
export function saveServer(choice: ServerChoice, overrides: Partial<ServerEnv> = {}): void {
  const env = { ...currentEnv(), ...overrides };
  const api = validateServerUrl(choice.api, env);
  const web = validateServerUrl(choice.web, env);
  if (!api.ok) throw new Error(api.reason);
  if (!web.ok) throw new Error(web.reason);
  const storage = storageOf(env);
  if (!storage) throw new Error('Không lưu được lựa chọn trên máy này.');
  storage.setItem(SERVER_STORAGE_KEY, JSON.stringify({ api: api.url, web: web.url }));
}

/** Back to the server built into the app. */
export function resetServer(overrides: Partial<ServerEnv> = {}): void {
  const storage = storageOf({ ...currentEnv(), ...overrides });
  try {
    storage?.removeItem(SERVER_STORAGE_KEY);
  } catch {
    // Nothing saved that we could remove.
  }
}
