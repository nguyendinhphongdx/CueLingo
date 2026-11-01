import { useEffect } from 'react';
import { native } from '../lib/native';
import { useTranscriptStore } from './transcript-store';

export function useTranscript(enabled = true) {
  const push = useTranscriptStore((state) => state.push);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void native.onTranscript(push).then((stopListening) => {
      if (disposed) stopListening();
      else unlisten = stopListening;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [enabled, push]);
}
