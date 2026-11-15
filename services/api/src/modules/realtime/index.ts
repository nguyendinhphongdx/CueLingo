/**
 * Realtime module — ordered live-caption translation over WebSocket.
 * Design: apps/docs/docs/04-modules/03-api/realtime.md
 */
import { realtimeRoutes } from './realtime.routes';
import type { RealtimeDeps, RealtimeUsage } from './realtime.service';

export function createRealtimeModule(deps: RealtimeDeps, usage: RealtimeUsage) {
  return { routes: realtimeRoutes(deps, usage) };
}

export type { RealtimeDeps } from './realtime.service';
