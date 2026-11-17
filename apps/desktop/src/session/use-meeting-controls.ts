import { SUPPORTED_LANGUAGES, type LanguageCode } from '@cuelingo/shared';
import { useCallback, useState } from 'react';
import { useMe } from '../auth';
import { native } from '../lib/native';
import { useLanguage, useSettings } from '../settings';
import { decideStart } from './capture-problems';
import { grantCloudConsent, hasCloudConsent, setConsentUser } from './cloud-consent';
import { sessionController, useSession } from './use-session';

export interface MeetingControls {
  /** Starts a meeting; `language` overrides the picker (a calendar entry that points to another language). */
  attempt: (language?: LanguageCode) => Promise<void>;
  halt: () => Promise<void>;
  pending: 'starting' | 'stopping' | null;
  /** The cloud-recognition consent dialog, for the language about to start. */
  consent: { open: boolean; confirm: () => void; cancel: () => void };
}

/**
 * Start and stop of a meeting, shared by the Start button and the calendar card.
 * The click answers at once (`pending`): the permission check, the native stop and the cloud drain
 * each take a second or more. A blocked microphone does not stop the meeting: the other person's
 * speech still gets captions, and the readiness list already shows the fix.
 */
export function useMeetingControls(): MeetingControls {
  const { me } = useMe();
  const userId = me?.id ?? 'dev';
  setConsentUser(userId);
  const assistLevel = useSettings((state) => state.assistLevel);
  const { language: picked, setLanguage } = useLanguage();
  const session = useSession();
  const [askFor, setAskFor] = useState<LanguageCode | null>(null);
  const [pending, setPending] = useState<MeetingControls['pending']>(null);

  const begin = useCallback(
    (language: LanguageCode) => {
      // A start while a meeting runs is ignored by the controller; the picked language must not change then.
      const { status } = sessionController.getSnapshot();
      if (status !== 'idle' && status !== 'error') return;
      if (language !== picked) setLanguage(language);
      void session.start(assistLevel, language);
    },
    [session, assistLevel, picked, setLanguage],
  );

  const attempt = async (override?: LanguageCode) => {
    if (pending) return;
    const language = override ?? picked;
    setPending('starting');
    try {
      const decision = await decideStart({
        needsConsent:
          SUPPORTED_LANGUAGES[language].recognition === 'cloud' && !hasCloudConsent(userId),
        readPermissions: native.permissionsStatus,
      });
      if (decision === 'ask-consent') setAskFor(language);
      else if (decision === 'mic-denied') {
        // Without the microphone, cloud audio still needs the consent first.
        if (SUPPORTED_LANGUAGES[language].recognition === 'cloud' && !hasCloudConsent(userId)) {
          setAskFor(language);
        } else begin(language);
      } else begin(language);
    } finally {
      setPending(null);
    }
  };

  const halt = async () => {
    if (pending) return;
    setPending('stopping');
    try {
      await session.stop();
    } finally {
      setPending(null);
    }
  };

  return {
    attempt,
    halt,
    pending,
    consent: {
      open: askFor !== null,
      cancel: () => setAskFor(null),
      confirm: () => {
        const language = askFor;
        setAskFor(null);
        grantCloudConsent(userId);
        if (language) begin(language);
      },
    },
  };
}
