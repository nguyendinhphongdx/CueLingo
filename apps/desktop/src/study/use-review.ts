import type { LanguageCode, ReviewAnswerRequest, ReviewCard, ReviewQueue } from '@cuelingo/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { studyApi, type StudyApi } from './study-api';

export type ReviewResult = { correct: number; incorrect: number; dueRemaining: number };

function nowMs() {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export async function submitReviewAnswer({
  api,
  card,
  rating,
  responseMs,
  submitting,
  advance,
}: {
  api: Pick<StudyApi, 'answerReview'>;
  card: ReviewCard;
  rating: ReviewAnswerRequest['rating'];
  responseMs: number;
  submitting: { current: boolean };
  advance: () => void;
}) {
  if (submitting.current) return false;
  submitting.current = true;
  try {
    await api.answerReview({
      itemId: card.itemId,
      exercise: card.exercise,
      rating,
      responseMs: Math.min(600_000, Math.max(0, Math.round(responseMs))),
    });
    advance();
    return true;
  } finally {
    submitting.current = false;
  }
}

export function useReview(language: LanguageCode) {
  const queueQuery = useQuery({
    queryKey: ['study', 'review-queue', language],
    queryFn: () => studyApi.getReviewQueue(language),
  });
  const answerMutation = useMutation({ mutationFn: studyApi.answerReview });
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

  // Another language has its own queue; drop the cards of the previous one.
  useEffect(() => {
    setQueue(null);
  }, [language]);

  useEffect(() => {
    if (queueQuery.data && queue === null) reset(queueQuery.data);
  }, [queueQuery.data, queue, reset]);

  const card = queue?.cards[cardIndex] ?? null;
  const isCorrect = selectedChoice !== null && selectedChoice === card?.answer;

  const choose = useCallback(
    (choice: string) => {
      if (!card || selectedChoice !== null || !card.choices.includes(choice)) return;
      setSelectedChoice(choice);
      if (choice === card.answer) setCorrect((value) => value + 1);
    },
    [card, selectedChoice],
  );

  const rate = useCallback(
    async (rating: ReviewAnswerRequest['rating']) => {
      if (!card || selectedChoice === null) return;
      try {
        await submitReviewAnswer({
          api: { answerReview: answerMutation.mutateAsync },
          card,
          rating,
          responseMs: nowMs() - startedAt.current,
          submitting,
          advance: () => {
            setCardIndex((value) => value + 1);
            setSelectedChoice(null);
            startedAt.current = nowMs();
          },
        });
      } catch {
        // The mutation error remains visible and this card stays ready to retry.
      }
    },
    [answerMutation.mutateAsync, card, selectedChoice],
  );

  /** Flashcard mode: the person graded themselves after turning the card, with no multiple choice. */
  const grade = useCallback(
    async (rating: ReviewAnswerRequest['rating']) => {
      if (!card) return;
      try {
        await submitReviewAnswer({
          api: { answerReview: answerMutation.mutateAsync },
          card,
          rating,
          responseMs: nowMs() - startedAt.current,
          submitting,
          advance: () => {
            setCardIndex((value) => value + 1);
            setSelectedChoice(null);
            if (rating >= 3) setCorrect((value) => value + 1);
            startedAt.current = nowMs();
          },
        });
      } catch {
        // The mutation error remains visible and this card stays ready to retry.
      }
    },
    [answerMutation.mutateAsync, card],
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
    selectedChoice,
    isCorrect,
    result,
    loading: queueQuery.isPending,
    error: queueQuery.isError || answerMutation.isError,
    submitting: answerMutation.isPending || submitting.current,
    choose,
    rate,
    grade,
    restart,
  };
}
