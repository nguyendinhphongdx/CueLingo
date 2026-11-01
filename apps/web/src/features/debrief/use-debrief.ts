import { ApiError } from '@cuelingo/core-sdk';
import type { DebriefFeedbackRequest, SavePhraseRequest } from '@cuelingo/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';
import { buildDebriefMarkdown } from './markdown';

const POLL_INTERVAL_MS = 5_000;
const POLL_LIMIT_MS = 2 * 60_000;

export function isDebriefNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export function shouldPollDebrief(error: unknown, elapsedMs: number) {
  return isDebriefNotFound(error) && elapsedMs < POLL_LIMIT_MS;
}

function phraseKey(input: Pick<SavePhraseRequest, 'phrase' | 'meaningVi'>) {
  return `${input.phrase}\u0000${input.meaningVi ?? ''}`;
}

export function useDebrief(sessionId: string, onDeleted?: () => void) {
  const pollingStartedAt = useRef(Date.now());
  const [savedPhraseKeys, setSavedPhraseKeys] = useState<ReadonlySet<string>>(new Set());

  const session = useQuery({
    queryKey: ['sessions', sessionId],
    queryFn: () => client.sessions.get(sessionId),
  });
  const debrief = useQuery({
    queryKey: ['sessions', sessionId, 'debrief'],
    queryFn: () => client.sessions.getDebrief(sessionId),
    retry: false,
    refetchInterval: (query) =>
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
  const remove = useMutation({
    mutationFn: () => client.sessions.remove(sessionId),
    onSuccess: () => onDeleted?.(),
  });

  const debriefNotFound = isDebriefNotFound(debrief.error);

  return {
    session: session.data,
    debrief: debrief.data,
    loading: session.isPending || debrief.isPending,
    processing: debriefNotFound,
    error:
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
    exportMarkdown: () => {
      if (!debrief.data) return;
      const blob = new Blob([buildDebriefMarkdown(debrief.data)], {
        type: 'text/markdown;charset=utf-8',
      });
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
