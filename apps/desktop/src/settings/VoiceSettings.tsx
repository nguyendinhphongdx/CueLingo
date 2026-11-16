import { forgetSpokenAudio } from '@cuelingo/ui/components/speak-button';
import { VoicePicker } from '@cuelingo/ui/components/voice-picker';
import { studyApi } from '../study/study-api';
import { queueSettingsPatch } from './settings-api';
import { useSettings } from './settings-store';

/** The reading voice, saved with the account so the web app and every client sound the same. */
export function VoiceSettings() {
  const voice = useSettings((state) => state.ttsVoice);
  const setVoice = useSettings((state) => state.setTtsVoice);

  return (
    <VoicePicker
      voice={voice}
      loadAudio={studyApi.speak}
      onChange={(next) => {
        setVoice(next);
        forgetSpokenAudio();
        queueSettingsPatch({ ttsVoice: next });
      }}
    />
  );
}
