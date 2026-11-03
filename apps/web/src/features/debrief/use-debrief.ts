import { ApiError } from '@cuelingo/core-sdk';
import type { DebriefFeedbackRequest, SavePhraseRequest } from '@cuelingo/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { client } from '../../lib/client';
import { debriefOutlook } from '@cuelingo/ui/lib/session-state';
import { describeError, describeRegenerateError } from '../../lib/errors';
import { buildDebriefMarkdown } from './markdown';

const POLL_INTERVAL_MS = 5_000;
export const LONG_WAIT_MS = 90_000;
export const COPY_CONFIRMATION_MS = 2_000;

export interface ClipboardFeedback {
  key: string;
  status: 'copied' | 'error';
}

export function isDebriefNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export function shouldPollDebrief(error: unknown, elapsedMs: number) {
  return isDebriefNotFound(error) && elapsedMs < LONG_WAIT_MS;
}

export function getProcessingStatus(startedAt: number, now = Date.now()) {
  const elapsedMs = Math.max(0, now - startedAt);
  return {
    elapsedMs,
    seconds: Math.floor(elapsedMs / 1_000),
    timedOut: elapsedMs >= LONG_WAIT_MS,
  };
}

export function scheduleClipboardFeedbackClear(clear: () => void) {
  return setTimeout(clear, COPY_CONFIRMATION_MS);
}

export async function writeClipboardText(
  text: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined = globalThis.navigator?.clipboard,
) {
  if (!clipboard) throw new Error('Clipboard API is unavailable');
  await clipboard.writeText(text);
}

function phraseKey(input: Pick<SavePhraseRequest, 'phrase' | 'meaningVi'>) {
  return `${input.phrase}\u0000${input.meaningVi ?? ''}`;
}

export function useDebrief(sessionId: string, onDeleted?: () => void) {
  const pollingStartedAt = useRef(Date.now());
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [savedPhraseKeys, setSavedPhraseKeys] = useState<ReadonlySet<string>>(new Set());
  const [clipboardFeedback, setClipboardFeedback] = useState<ClipboardFeedback | null>(null);

  const session = useQuery({
    queryKey: ['sessions', sessionId],
    queryFn: () => client.sessions.get(sessionId),
  });
  // Read inside the polling callback: a live or empty meeting will never get a debrief.
  const canWaitRef = useRef(true);
  const debrief = useQuery({
    queryKey: ['sessions', sessionId, 'debrief'],
    queryFn: () => client.sessions.getDebrief(sessionId),
    retry: false,
    refetchInterval: (query) =>
      canWaitRef.current &&
      shouldPollDebrief(query.state.error, Date.now() - pollingStartedAt.current)
        ? POLL_INTERVAL_MS
        : false,
  });
  const feedback = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DebriefFeedbackRequest }) =>
      client.debriefs.feedback(id, input),
  });
  const save = useMutation({
    mutationFn: (input: SavePhraseRequest) => client.phrases.save(input),
    onSuccess: (_phrase, input) => {
      setSavedPhraseKeys((current) => new Set(current).add(phraseKey(input)));
    },
  });
  const regenerate = useMutation({
    mutationFn: () => client.regenerateDebrief(sessionId),
    onSuccess: () => {
      // A new wait: reset the timer and poll again.
      pollingStartedAt.current = Date.now();
      setNow(pollingStartedAt.current);
      void debrief.refetch();
    },
  });
  const remove = useMutation({
    mutationFn: () => client.sessions.remove(sessionId),
    onSuccess: () => onDeleted?.(),
  });

  const outlook = session.data ? debriefOutlook(session.data) : 'pending';
  canWaitRef.current = outlook === 'pending';
  const debriefNotFound = isDebriefNotFound(debrief.error) && outlook === 'pending';
  const processingStatus = getProcessingStatus(pollingStartedAt.current, now);
  const processingElapsedMs = debriefNotFound ? processingStatus.elapsedMs : 0;

  useEffect(() => {
    if (!debriefNotFound || processingElapsedMs >= LONG_WAIT_MS) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [debriefNotFound, processingElapsedMs]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const copyText = async (key: string, text: string) => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      await writeClipboardText(text);
      setClipboardFeedback({ key, status: 'copied' });
    } catch {
      setClipboardFeedback({ key, status: 'error' });
    }
    copyTimer.current = scheduleClipboardFeedbackClear(() => setClipboardFeedback(null));
  };

  return {
    session: session.data,
    debrief: debrief.data,
    loading: session.isPending || debrief.isPending,
    processing: debriefNotFound,
    processingSeconds: debriefNotFound ? processingStatus.seconds : 0,
    processingTimedOut: debriefNotFound && processingStatus.timedOut,
    regenerating: regenerate.isPending,
    regenerateDebrief: () => regenerate.mutate(),
    error:
      (regenerate.error ? describeRegenerateError(regenerate.error) : null) ??
      describeError(session.error) ??
      (debriefNotFound ? null : describeError(debrief.error)) ??
      describeError(feedback.error) ??
      describeError(save.error) ??
      describeError(remove.error),
    feedbackBlock: feedback.isPending ? (feedback.variables?.input.block ?? null) : null,
    feedbackValue: feedback.isSuccess ? feedback.variables?.input : undefined,
    sendFeedback: (block: DebriefFeedbackRequest['block'], useful: boolean) => {
      if (!debrief.data) return;
      feedback.mutate({ id: debrief.data.id, input: { block, useful } });
    },
    savedPhraseKeys,
    savingPhraseKey: save.isPending && save.variables ? phraseKey(save.variables) : null,
    savePhrase: (input: SavePhraseRequest) => save.mutateAsync(input),
    clipboardFeedback,
    copyText,
    exportMarkdown: (includeTranscript = false) => {
      if (!debrief.data) return;
      const blob = new Blob(
        [
          buildDebriefMarkdown(debrief.data, {
            session: session.data,
            includeTranscript,
          }),
        ],
        {
          type: 'text/markdown;charset=utf-8',
        },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `debrief-${sessionId}.md`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    deleting: remove.isPending,
    deleteSession: () => remove.mutate(),
    phraseKey,
  };
}
