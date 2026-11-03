import type { Debrief } from '@cuelingo/shared';
import { useEffect, useState } from 'react';
import { debriefApi } from './debrief-api';
import { pollDebrief } from './debrief-brief';

export type BriefState =
  | { status: 'pending' }
  | { status: 'ready'; debrief: Debrief }
  | { status: 'timeout' }
  | { status: 'denied' };

/** Polls the finished meeting's debrief; stops on unmount or when the meeting id changes. */
export function useDebriefBrief(sessionId: string | null): BriefState {
  const [result, setResult] = useState<{ sessionId: string; state: BriefState } | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    return pollDebrief(debriefApi, sessionId, {
      onReady: (debrief) => setResult({ sessionId, state: { status: 'ready', debrief } }),
      onTimeout: () => setResult({ sessionId, state: { status: 'timeout' } }),
      onDenied: () => setResult({ sessionId, state: { status: 'denied' } }),
    });
  }, [sessionId]);
  return result && result.sessionId === sessionId ? result.state : { status: 'pending' };
}
