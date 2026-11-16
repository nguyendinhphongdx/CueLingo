import { Loader2, Square, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconButton } from './icon-button';

export type SpeakStatus = 'idle' | 'loading' | 'playing' | 'error';

/** Object URLs of audio already fetched, by text: hearing a phrase again never asks the network twice. */
const audioUrls = new Map<string, Promise<string>>();

/** Forget what was fetched, for when the reading voice changes and old audio would be the wrong voice. */
export function forgetSpokenAudio() {
  audioUrls.clear();
}

function audioUrl(
  text: string,
  loadAudio: (text: string) => Promise<Blob>,
  scope: string,
): Promise<string> {
  const key = `${scope}|${text}`;
  let pending = audioUrls.get(key);
  if (!pending) {
    pending = loadAudio(text).then((blob) => URL.createObjectURL(blob));
    audioUrls.set(key, pending);
    // A failure must not be remembered, or the phrase could never be retried.
    pending.catch(() => audioUrls.delete(key));
  }
  return pending;
}

/** Plays spoken audio for a text; `loadAudio` is how each client fetches it (its own auth, its own URL). */
/** `scope` separates audio of the same text that sounds different (a voice being tried). */
export function useSpeaker(loadAudio: (text: string) => Promise<Blob>, scope = '') {
  const [status, setStatus] = useState<SpeakStatus>('idle');
  const player = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0);

  const stop = useCallback(() => {
    run.current += 1;
    player.current?.pause();
    player.current = null;
    setStatus('idle');
  }, []);

  const play = useCallback(
    async (text: string, rate = 1) => {
      run.current += 1;
      const mine = run.current;
      player.current?.pause();
      setStatus('loading');
      try {
        const url = await audioUrl(text, loadAudio, scope);
        if (run.current !== mine) return;
        const audio = new Audio(url);
        audio.playbackRate = rate;
        audio.onended = () => run.current === mine && setStatus('idle');
        audio.onerror = () => run.current === mine && setStatus('error');
        player.current = audio;
        await audio.play();
        if (run.current === mine) setStatus('playing');
      } catch {
        if (run.current === mine) setStatus('error');
      }
    },
    [loadAudio, scope],
  );

  useEffect(() => () => player.current?.pause(), []);

  return { status, play, stop };
}

/** A small "listen" button for any English phrase. */
export function SpeakButton({
  text,
  loadAudio,
  className,
  scope,
}: {
  text: string;
  loadAudio: (text: string) => Promise<Blob>;
  className?: string;
  scope?: string;
}) {
  const { status, play, stop } = useSpeaker(loadAudio, scope);
  const icon =
    status === 'loading' ? (
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
    ) : status === 'playing' ? (
      <Square aria-hidden="true" className="size-3.5 fill-current" />
    ) : (
      <Volume2 aria-hidden="true" className="size-4" />
    );

  return (
    <IconButton
      label={
        status === 'error'
          ? 'Không phát được, bấm để thử lại'
          : status === 'playing'
            ? 'Dừng'
            : 'Nghe phát âm'
      }
      aria-busy={status === 'loading'}
      active={status === 'playing'}
      className={className}
      icon={icon}
      onClick={() => (status === 'playing' ? stop() : void play(text))}
    />
  );
}
