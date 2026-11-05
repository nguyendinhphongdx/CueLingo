import type { LanguageCode, ReviewAnswerRequest, ReviewQueue } from '@cuelingo/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

export type ReviewResult = { correct: number; incorrect: number; dueRemaining: number };

function nowMs() {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function useReview(language: LanguageCode) {
  const queueQuery = useQuery({
    queryKey: ['review', 'queue', language],
    queryFn: () => client.review.queue(language),
  });
  const answerMutation = useMutation({ mutationFn: client.review.answer });
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const startedAt = useRef(nowMs());
  const submitting = useRef(false);

  const reset = useCallback((nextQueue: ReviewQueue) => {
    setQueue(nextQueue);
    setCardIndex(0);
    setSelectedChoice(null);
    setCorrect(0);
    startedAt.current = nowMs();
    submitting.current = false;
  }, []);

  useEffect(() => {
    if (queueQuery.data && queue === null) reset(queueQuery.data);
  }, [queueQuery.data, queue, reset]);

  // Another language has its own queue; drop the cards of the previous one.
  useEffect(() => {
    setQueue(null);
  }, [language]);

  const card = queue?.cards[cardIndex] ?? null;
  const answered = selectedChoice !== null;
  const isCorrect = answered && selectedChoice === card?.answer;

  const choose = useCallback(
    (choice: string) => {
      if (!card || selectedChoice !== null) return;
      setSelectedChoice(choice);
      if (choice === card.answer) setCorrect((value) => value + 1);
    },
    [card, selectedChoice],
  );

  const rate = useCallback(
    async (rating: ReviewAnswerRequest['rating']) => {
      if (!card || selectedChoice === null || submitting.current) return;
      submitting.current = true;
      try {
        await answerMutation.mutateAsync({
          itemId: card.itemId,
          exercise: card.exercise,
          rating,
          responseMs: Math.min(600_000, Math.max(0, Math.round(nowMs() - startedAt.current))),
        });
        setCardIndex((value) => value + 1);
        setSelectedChoice(null);
        startedAt.current = nowMs();
      } catch {
        // The mutation exposes a localized error while keeping this card ready to retry.
      } finally {
        submitting.current = false;
      }
    },
    [answerMutation, card, selectedChoice],
  );

  /** Flashcard mode: the person graded themselves after turning the card, with no multiple choice. */
  const grade = useCallback(
    async (rating: ReviewAnswerRequest['rating']) => {
      if (!card || submitting.current) return;
      submitting.current = true;
      try {
        await answerMutation.mutateAsync({
          itemId: card.itemId,
          exercise: card.exercise,
          rating,
          responseMs: Math.min(600_000, Math.max(0, Math.round(nowMs() - startedAt.current))),
        });
        setCardIndex((value) => value + 1);
        setSelectedChoice(null);
        if (rating >= 3) setCorrect((value) => value + 1);
        startedAt.current = nowMs();
      } catch {
        // The mutation exposes a localized error while keeping this card ready to retry.
      } finally {
        submitting.current = false;
      }
    },
    [answerMutation, card],
  );

  const restart = useCallback(async () => {
    const refreshed = await queueQuery.refetch();
    if (refreshed.data) reset(refreshed.data);
  }, [queueQuery, reset]);

  const total = queue?.cards.length ?? 0;
  const finished = Boolean(queue && total > 0 && cardIndex >= total);
  const result: ReviewResult | null = finished
    ? {
        correct,
        incorrect: total - correct,
        dueRemaining: Math.max(0, (queue?.dueCount ?? 0) - total),
      }
    : null;

  return {
    card,
    cardIndex,
    total,
    dueCount: queue?.dueCount ?? 0,
    selectedChoice,
    isCorrect,
    result,
    loading: queueQuery.isPending,
    error: describeError(queueQuery.error) ?? describeError(answerMutation.error),
    submitting: answerMutation.isPending,
    choose,
    rate,
    grade,
    restart,
  };
}
