import { serverConfig } from '../server';
import { ApiError } from '@cuelingo/core-sdk';
import { ErrorResponseSchema, MeSchema, type Me } from '@cuelingo/shared';
import { currentToken } from './auth-store';
import { resolveToken, type TokenSource } from './token';

type Fetch = typeof fetch;

export interface MeApi {
  get(): Promise<Me>;
}

interface MeApiOptions {
  apiUrl: string;
  token: TokenSource;
  fetch?: Fetch;
}

/** The server no longer accepts this device's token (revoked, expired, or issued by another server). */
export const isUnauthorized = (error: unknown): boolean =>
  error instanceof ApiError && error.code === 'UNAUTHORIZED';

export function describeMeError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'UNAUTHORIZED') return 'Phiên đăng nhập đã hết hạn.';
    if (error.code === 'NETWORK_ERROR') return 'Không kết nối được tới máy chủ.';
  }
  return 'Không tải được thông tin tài khoản.';
}

export function createMeApi({ apiUrl, token, fetch: request = fetch }: MeApiOptions): MeApi {
  const baseUrl = apiUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');

  return {
    async get() {
      let response: Response;
      try {
        response = await request(`${baseUrl}/v1/me`, {
          headers: { Authorization: `Bearer ${resolveToken(token)}` },
        });
      } catch (error) {
        throw new ApiError(0, 'NETWORK_ERROR', (error as Error).message);
      }

      if (!response.ok) {
        const parsed = ErrorResponseSchema.safeParse(await response.json().catch(() => null));
        if (parsed.success) {
          throw new ApiError(
            response.status,
            parsed.data.error.code,
            parsed.data.error.message,
            parsed.data.error.details,
          );
        }
        throw new ApiError(response.status, 'INTERNAL_ERROR', `HTTP ${response.status}`);
      }

      return MeSchema.parse(await response.json());
    },
  };
}

export const meApi = createMeApi({
  apiUrl: serverConfig().apiUrl,
  token: currentToken,
});
