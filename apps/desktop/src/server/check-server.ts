export const CHECK_TIMEOUT_MS = 5000;

export type ServerCheck = { ok: true } | { ok: false; cause: string };

/**
 * Asks the server's `/healthz` whether it answers. The cause is a short Vietnamese sentence made from fixed text only:
 * the address and the raw error never leave this function, so a custom address cannot reach a log or a report.
 */
export async function checkServer(
  apiUrl: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<ServerCheck> {
  const { fetcher = fetch, timeoutMs = CHECK_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`${apiUrl.replace(/\/+$/, '')}/healthz`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!response.ok) {
      return { ok: false, cause: `Máy chủ trả về lỗi (mã ${response.status}).` };
    }
    const body: unknown = await response.json().catch(() => null);
    if (typeof body !== 'object' || body === null || (body as { ok?: unknown }).ok !== true) {
      return { ok: false, cause: 'Địa chỉ này không phải máy chủ CueLingo.' };
    }
    return { ok: true };
  } catch {
    if (controller.signal.aborted) {
      return { ok: false, cause: 'Máy chủ không phản hồi (quá thời gian chờ).' };
    }
    return { ok: false, cause: 'Không kết nối được. Kiểm tra địa chỉ và mạng.' };
  } finally {
    clearTimeout(timer);
  }
}
