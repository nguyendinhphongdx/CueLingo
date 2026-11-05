import { useEffect, useSyncExternalStore } from 'react';
import { native } from '../lib/native';
import { sessionController } from '../session/use-session';
import { createUpdateController, UPDATE_CHECK_MS } from './update-controller';

export const updater = createUpdateController({
  check: () => native.checkUpdate(),
  meetingActive: () => sessionController.getSnapshot().status !== 'idle',
});

/** Mount once: checks on open and every 6 hours. */
export function useUpdater() {
  useEffect(() => {
    void updater.check();
    const timer = window.setInterval(() => void updater.check(), UPDATE_CHECK_MS);
    return () => window.clearInterval(timer);
  }, []);
  const state = useSyncExternalStore(updater.subscribe, updater.getState, updater.getState);
  const meetingStatus = useSyncExternalStore(
    sessionController.subscribe,
    () => sessionController.getSnapshot().status,
  );
  return {
    state,
    locked: meetingStatus !== 'idle',
    install: updater.install,
    dismiss: updater.dismiss,
  };
}
