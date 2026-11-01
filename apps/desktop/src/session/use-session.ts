import { createRealtimeClient } from '@cuelingo/core-sdk';
import { useSyncExternalStore } from 'react';
import { native } from '../lib/native';
import { createSessionController } from './session-controller';
import { sessionsApi } from './sessions-api';

const controller = createSessionController({
  native,
  sessions: sessionsApi,
  createRealtime: createRealtimeClient,
  apiUrl: import.meta.env.VITE_API_URL || 'ws://localhost:4000',
  token: import.meta.env.VITE_REALTIME_TOKEN || 'dev-token',
});

export function useSession() {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  return {
    ...snapshot,
    start: controller.start,
    stop: controller.stop,
    runDemo: controller.runDemo,
  };
}
