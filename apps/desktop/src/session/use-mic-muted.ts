import { useEffect, useState } from 'react';
import { native } from '../lib/native';

type MicSource = Pick<typeof native, 'onMicState' | 'setMicMuted' | 'onAudioStatus' | 'micMuted'>;

/**
 * Whether the microphone is switched off, and a way to switch it. The state is the sidecar's own answer, so
 * the button never claims the mic is off before it really is; every new meeting starts with it on.
 * `failed` is true when the sidecar could not open the microphone at all (then there is nothing to switch).
 */
export function useMicMuted(enabled = true, source: MicSource = native) {
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    // A window that opens (or reloads) in the middle of a meeting starts from the real state.
    void source
      .micMuted()
      .then((now) => !disposed && setMuted(now))
      .catch(() => undefined);
    const unlisteners: (() => void)[] = [];
    const keep = (stop: () => void) => {
      if (disposed) stop();
      else unlisteners.push(stop);
    };
    void source
      .onMicState((event) => {
        setMuted(event.muted);
        // A new meeting (or a successful reopen) clears an old failure.
        if (!event.muted) setFailed(false);
      })
      .then(keep);
    void source
      .onAudioStatus((event) => {
        if (event.state === 'error' && event.message?.startsWith('microphone:')) setFailed(true);
      })
      .then(keep);
    return () => {
      disposed = true;
      unlisteners.forEach((stop) => stop());
    };
  }, [enabled, source]);

  return { muted, failed, setMuted: (next: boolean) => source.setMicMuted(next) };
}
