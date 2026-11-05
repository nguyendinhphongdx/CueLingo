import { useEffect } from 'react';
import { activation } from './instance';

/** Mount once at the top of the app, with the signed-in person's id (null while signed out). */
export function useActivationTelemetry(userId: string | null) {
  useEffect(() => {
    activation.recordLaunch();
  }, []);
  useEffect(() => {
    if (userId) void activation.signedIn(userId);
    else activation.signedOut();
  }, [userId]);
}
