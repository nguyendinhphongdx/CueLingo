import { SUPPORTED_LANGUAGES, type LanguageCode } from '@cuelingo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMe } from '../auth';
import { gateAction, type ModelView } from '../models/model-state';
import { useLocalModels } from '../models/use-local-models';
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
  /** The model dialog: the model is not on this machine, so it comes down here and the meeting starts after. */
  gate: {
    open: boolean;
    languageName: string;
    view: ModelView | null;
    download: () => void;
    restart: () => void;
    cancelDownload: () => void;
    close: () => void;
  };
}

/**
 * Start and stop of a meeting, shared by the Start button and the calendar card.
 * The click answers at once (`pending`): the native start, the native stop and the cloud drain
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
  const models = useLocalModels();
  const { download } = models;
  const [gateFor, setGateFor] = useState<LanguageCode | null>(null);
  // The download starts by itself once per dialog (the person pressed Start); after a cancel they decide.
  const gateStarted = useRef(false);
  const gateView = gateFor ? models.view(gateFor) : null;

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

  /** Starts the meeting, or opens the model dialog first when the model is not on this machine. */
  const proceed = (language: LanguageCode) => {
    if (gateAction(models.view(language), false) === 'begin') begin(language);
    else {
      gateStarted.current = false;
      setGateFor(language);
    }
  };

  useEffect(() => {
    if (gateFor === null) return;
    const action = gateAction(gateView, gateStarted.current);
    if (action === 'begin') {
      setGateFor(null);
      begin(gateFor);
    } else if (action === 'download') {
      gateStarted.current = true;
      void download(gateFor);
    }
  }, [gateFor, gateView, begin, download]);

  const attempt = async (override?: LanguageCode) => {
    if (pending) return;
    const language = override ?? picked;
    setPending('starting');
    try {
      // A missing microphone permission does not block Start: the sidecar reports it and a banner says so.
      const decision = decideStart({
        needsConsent:
          SUPPORTED_LANGUAGES[language].recognition === 'cloud' && !hasCloudConsent(userId),
      });
      if (decision === 'ask-consent') setAskFor(language);
      else proceed(language);
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
        if (language) proceed(language);
      },
    },
    gate: {
      open: gateFor !== null,
      languageName: gateFor ? SUPPORTED_LANGUAGES[gateFor].name.toLowerCase() : '',
      view: gateView,
      download: () => {
        if (gateFor) void models.download(gateFor);
      },
      restart: () => {
        if (gateFor) void models.restart(gateFor);
      },
      cancelDownload: () => {
        if (gateFor) void models.cancel(gateFor);
      },
      close: () => setGateFor(null),
    },
  };
}
