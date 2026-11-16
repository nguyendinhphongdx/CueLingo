import type { TtsVoice } from '@cuelingo/shared';
import { TTS_VOICES } from '@cuelingo/shared';
import { SpeakButton } from './speak-button';
import { Segmented } from './segmented';

/** A fixed sentence, so every voice is judged on the same words. */
export const VOICE_SAMPLE = 'Could we circle back on this after the meeting?';

/**
 * The reading voice: pick one and hear it before it is saved. `loadAudio` fetches the sample in the
 * voice being tried, with the client's own auth.
 */
export function VoicePicker({
  voice,
  onChange,
  loadAudio,
  disabled,
  error,
}: {
  voice: TtsVoice;
  onChange: (voice: TtsVoice) => void;
  loadAudio: (text: string, voice: TtsVoice) => Promise<Blob>;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <section aria-labelledby="voice-title" className="space-y-3">
      <div>
        <h2 id="voice-title" className="text-sm font-semibold">
          Giọng đọc
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Dùng khi bạn bấm nghe ở Nói giúp, tra từ và Ôn tập. Chỉ phát ra loa máy bạn.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Segmented
            label="Giọng đọc"
            value={voice}
            disabled={disabled}
            onChange={onChange}
            options={TTS_VOICES.map((name) => ({ value: name, label: name }))}
          />
        </div>
        <SpeakButton
          text={VOICE_SAMPLE}
          scope={voice}
          loadAudio={(text) => loadAudio(text, voice)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
