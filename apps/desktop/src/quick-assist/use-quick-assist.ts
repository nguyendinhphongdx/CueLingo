import {
  DEFAULT_LANGUAGE,
  isLanguageCode,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from '@cuelingo/shared';
import type { ComposeResponse, LookupResponse, RecapResponse } from '@cuelingo/shared';
import { useCallback, useEffect, useState } from 'react';
import { native, type HotkeyEvent } from '../lib/native';
import { selectRecentSystemSentences, useTranscriptStore } from '../overlay/transcript-store';
import { assistApi, type AssistApi } from './assist-api';

type RequestStatus = 'idle' | 'loading' | 'error' | 'success';

export type QuickAssistState =
  | { view: 'closed' }
  | {
      view: 'lookup';
      status: Exclude<RequestStatus, 'idle'>;
      term: string;
      context: string;
      result?: LookupResponse;
    }
  | { view: 'recap'; status: Exclude<RequestStatus, 'idle'>; result?: RecapResponse }
  | {
      view: 'compose';
      status: RequestStatus;
      intent: string;
      result?: ComposeResponse;
      selectedIndex?: number;
      copyStatus?: 'copied' | 'error';
    };

type HotkeySource = Pick<typeof native, 'onHotkey'>;

export function listenForQuickAssistHotkeys(
  callback: (event: HotkeyEvent) => void,
  source: HotkeySource = native,
) {
  return source.onHotkey(callback);
}

/** The language of the meeting being captioned: that of the latest caption, English before any arrives. */
export function meetingLanguage(): LanguageCode {
  const code = useTranscriptStore.getState().segments.at(-1)?.language;
  return isLanguageCode(code) ? code : DEFAULT_LANGUAGE;
}

/** Lookup and "Nói giúp" only exist for languages the learner can study; recap works for every enabled one. */
export function meetingLearnable(): boolean {
  return SUPPORTED_LANGUAGES[meetingLanguage()].learnable;
}

function now() {
  return new Date().toISOString();
}

export function useQuickAssist({
  listen = true,
  api = assistApi,
}: {
  listen?: boolean;
  api?: AssistApi;
} = {}) {
  const [state, setState] = useState<QuickAssistState>({ view: 'closed' });

  const lookup = useCallback(
    async (term: string, context: string) => {
      if (!meetingLearnable()) {
        setState({ view: 'lookup', status: 'error', term, context });
        return;
      }
      setState({ view: 'lookup', status: 'loading', term, context });
      void api.record({ type: 'lookup', term, at: now() }).catch(() => undefined);
      try {
        const result = await api.lookup({ term, context, language: meetingLanguage() });
        setState({ view: 'lookup', status: 'success', term, context, result });
      } catch {
        setState({ view: 'lookup', status: 'error', term, context });
      }
    },
    [api],
  );

  const openRecap = useCallback(async () => {
    const sentences = selectRecentSystemSentences(useTranscriptStore.getState().segments);
    setState({ view: 'recap', status: 'loading' });
    if (sentences.length === 0) {
      setState({ view: 'recap', status: 'error' });
      return;
    }

    void api.record({ type: 'recap_used', at: now() }).catch(() => undefined);
    try {
      const result = await api.recap({
        sentences: sentences.map((text) => ({ text })),
        language: meetingLanguage(),
      });
      setState({ view: 'recap', status: 'success', result });
    } catch {
      setState({ view: 'recap', status: 'error' });
    }
  }, [api]);

  const openCompose = useCallback(() => {
    setState({ view: 'compose', status: 'idle', intent: '' });
  }, []);

  const submitCompose = useCallback(
    async (intent: string) => {
      const trimmedIntent = intent.trim();
      if (!trimmedIntent || !meetingLearnable()) return;
      const context = selectRecentSystemSentences(useTranscriptStore.getState().segments, 10);
      setState({ view: 'compose', status: 'loading', intent: trimmedIntent });
      try {
        const result = await api.compose({
          intentVi: trimmedIntent,
          language: meetingLanguage(),
          ...(context.length > 0 ? { context } : {}),
        });
        setState({ view: 'compose', status: 'success', intent: trimmedIntent, result });
      } catch {
        setState({ view: 'compose', status: 'error', intent: trimmedIntent });
      }
    },
    [api],
  );

  const selectOption = useCallback(
    (index: number) => {
      setState((current) =>
        current.view === 'compose' ? { ...current, selectedIndex: index } : current,
      );
      void api
        .record({ type: 'compose_used', chosenIndex: index, at: now() })
        .catch(() => undefined);
    },
    [api],
  );

  const copyOption = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setState((current) =>
        current.view === 'compose' ? { ...current, copyStatus: 'copied' } : current,
      );
    } catch {
      setState((current) =>
        current.view === 'compose' ? { ...current, copyStatus: 'error' } : current,
      );
    }
  }, []);

  useEffect(() => {
    if (!listen) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listenForQuickAssistHotkeys(({ action }) => {
      if (action === 'recap') void openRecap();
      if (action === 'say_for_me') openCompose();
    }).then((stopListening) => {
      if (disposed) stopListening();
      else unlisten = stopListening;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [listen, openCompose, openRecap]);

  return {
    state,
    lookup,
    retryLookup: () => {
      if (state.view === 'lookup') void lookup(state.term, state.context);
    },
    openRecap: () => void openRecap(),
    retryRecap: () => void openRecap(),
    openCompose,
    setComposeIntent: (intent: string) => {
      setState((current) =>
        current.view === 'compose' ? { ...current, intent, copyStatus: undefined } : current,
      );
    },
    submitCompose: () => {
      if (state.view === 'compose') void submitCompose(state.intent);
    },
    retryCompose: () => {
      if (state.view === 'compose') void submitCompose(state.intent);
    },
    selectOption,
    copyOption: (text: string) => void copyOption(text),
    close: () => setState({ view: 'closed' }),
  };
}

export type QuickAssistActions = ReturnType<typeof useQuickAssist>;
