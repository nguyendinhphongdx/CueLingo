/**
 * @cuelingo/core-sdk — typed client used by apps/desktop and apps/web. Apps never call fetch directly.
 * Design: apps/docs/docs/04-modules/05-packages/core-sdk.md
 */
import { glossaryApi } from './glossary';
import { createHttp, type ClientOptions } from './http';

export function createClient(options: ClientOptions) {
  const http = createHttp(options);
  return { glossary: glossaryApi(http) };
}

export type CueLingoClient = ReturnType<typeof createClient>;
export { ApiError, type ClientOptions } from './http';
export {
  createRealtimeClient,
  type RealtimeClient,
  type RealtimeClientOptions,
  type RealtimeSocket,
  type RealtimeState,
} from './realtime';
