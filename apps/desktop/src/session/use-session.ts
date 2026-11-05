import { createRealtimeClient } from '@cuelingo/core-sdk';
import { useSyncExternalStore } from 'react';
import { currentToken } from '../auth';
import { insightsApi } from '../insights';
import { native } from '../lib/native';
import { hasCloudConsent } from './cloud-consent';
import { refreshOnGlossaryChange } from './glossary-refresh';
import { createSessionController } from './session-controller';
import { sessionsApi } from './sessions-api';
import { startTraySync } from './tray-sync';
import { activation } from '../telemetry/instance';

const controller = createSessionController({
  native,
  sessions: sessionsApi,
  hasCloudConsent: () => hasCloudConsent(),
  glossary: { list: insightsApi.listGlossary },
  createRealtime: createRealtimeClient,
  onFirstCaption: (sessionId) => void activation.captionShown(sessionId),
  apiUrl: import.meta.env.VITE_API_URL || 'ws://localhost:4000',
  token: currentToken,
});

// The menu-bar icon follows the meeting even while the window is hidden.
startTraySync(controller, native);

// A glossary edit on the Terms page reaches the running meeting's speech model.
refreshOnGlossaryChange(controller);

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
    acceptSuggestedLanguage: controller.acceptSuggestedLanguage,
    dismissSuggestedLanguage: controller.dismissSuggestedLanguage,
    runDemo: controller.runDemo,
  };
}
