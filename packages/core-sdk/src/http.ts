import { ErrorResponseSchema, type ErrorCode } from '@cuelingo/shared';
import type { z } from 'zod';

export interface ClientOptions {
  baseUrl: string;
  /** Returns the current access token, or null when signed out. */
  getToken: () => Promise<string | null> | string | null;
  fetch?: typeof fetch;
  /** Browsers: 'include' sends the session cookie to an API on another origin. */
  credentials?: RequestCredentials;
}

/** Error thrown for any non-2xx response; `code` comes from @cuelingo/shared ErrorCode. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export type Http = ReturnType<typeof createHttp>;

export function createHttp(options: ClientOptions) {
  const doFetch = options.fetch ?? fetch;

  /** Sends one request with auth and maps any failure to ApiError; the caller reads the 2xx body. */
  async function send(
    method: string,
    path: string,
    body: unknown,
    init: { signal?: AbortSignal; accept?: string } | undefined,
  ): Promise<Response> {
    const token = await options.getToken();
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (init?.accept) headers.accept = init.accept;

    // The token lookup is async: a request cancelled meanwhile must not be sent at all.
    if (init?.signal?.aborted) throw new ApiError(0, 'NETWORK_ERROR', 'Request aborted');

    let res: Response;
    try {
      res = await doFetch(`${options.baseUrl}${path}`, {
        method,
        headers,
        credentials: options.credentials,
        signal: init?.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new ApiError(0, 'NETWORK_ERROR', (err as Error).message);
    }

    if (!res.ok) {
      const parsed = ErrorResponseSchema.safeParse(await res.json().catch(() => null));
      if (parsed.success) {
        const { code, message, details } = parsed.data.error;
        throw new ApiError(res.status, code, message, details);
      }
      throw new ApiError(res.status, 'INTERNAL_ERROR', `HTTP ${res.status}`);
    }
    return res;
  }

  async function request<S extends z.ZodType>(
    method: string,
    path: string,
    schema: S | null,
    body?: unknown,
    init?: { signal?: AbortSignal },
  ): Promise<z.output<S>> {
    const res = await send(method, path, body, init);
    // Validate responses too: a contract drift fails loudly here instead of deep in the UI.
    return (schema ? schema.parse(await res.json()) : undefined) as z.output<S>;
  }

  /**
   * Like `request`, but hands back the open response so the caller reads a long body (a server-sent
   * event stream) itself. Errors that arrive before the body starts are the same JSON `ApiError`s.
   */
  function stream(
    method: string,
    path: string,
    body?: unknown,
    init?: { signal?: AbortSignal },
  ): Promise<Response> {
    return send(method, path, body, { ...init, accept: 'text/event-stream' });
  }

  return { request, stream };
}
