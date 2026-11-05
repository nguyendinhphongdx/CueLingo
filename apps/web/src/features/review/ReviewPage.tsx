'use client';

import type { ReviewAnswerRequest, ReviewCard } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { DictationCard } from '@cuelingo/ui/components/dictation-card';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { SpeakButton } from '@cuelingo/ui/components/speak-button';
import Link from 'next/link';
import { FlashcardDeck } from '@cuelingo/ui/components/flashcard-deck';
import { Segmented } from '@cuelingo/ui/components/segmented';
import { useEffect, useState } from 'react';
import { client } from '../../lib/client';
import { useLanguage } from '../../lib/language';
import { type ReviewResult, useReview } from './use-review';

const RATINGS = [
  { value: 1, label: 'Lại' },
  { value: 2, label: 'Khó' },
  { value: 3, label: 'Được' },
  { value: 4, label: 'Dễ' },
] as const;

type ReviewMode = 'flip' | 'quiz';
const MODES: { value: ReviewMode; label: string }[] = [
  { value: 'flip', label: 'Lật thẻ' },
  { value: 'quiz', label: 'Trắc nghiệm' },
];
const MODE_KEY = 'cuelingo.reviewMode';

export function ReviewSession({
  card,
  position,
  total,
  selectedChoice,
  submitting,
  onChoose,
  onRate,
  loadAudio = client.tts.speak,
}: {
  card: ReviewCard;
  position: number;
  total: number;
  selectedChoice: string | null;
  submitting: boolean;
  onChoose: (choice: string) => void;
  onRate: (rating: ReviewAnswerRequest['rating']) => void;
  loadAudio?: (text: string) => Promise<Blob>;
}) {
  const answered = selectedChoice !== null;
  const correct = selectedChoice === card.answer;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardDescription>
            {card.exercise === 'recognize'
              ? 'Chọn nghĩa đúng'
              : card.exercise === 'dictation'
                ? 'Nghe và gõ lại'
                : 'Chọn cụm từ còn thiếu'}
          </CardDescription>
          <span className="text-sm font-medium" aria-label={`Thẻ ${position} trên ${total}`}>
            {position}/{total}
          </span>
        </div>
        <div
          className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Tiến độ phiên ôn tập"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={position}
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${(position / total) * 100}%` }}
          />
        </div>
        {card.exercise === 'dictation' ? (
          <CardTitle className="pt-5 text-xl leading-relaxed">Bạn nghe được cụm từ nào?</CardTitle>
        ) : (
          <CardTitle className="pt-5 text-2xl leading-relaxed">{card.prompt}</CardTitle>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {card.exercise === 'dictation' ? (
          <DictationCard
            card={card}
            language={card.language}
            loadAudio={loadAudio}
            onAnswer={(result) => onChoose(result.correct ? card.answer : result.typed || '—')}
          />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {card.choices.map((choice, index) => {
            const isAnswer = answered && choice === card.answer;
            const isWrongChoice = answered && choice === selectedChoice && !isAnswer;
            return (
              <Button
                key={choice}
                type="button"
                variant="outline"
                className={`min-h-11 h-auto justify-start whitespace-normal px-4 py-3 text-left ${
                  isAnswer
                    ? 'border-green-700 bg-green-50 text-green-950 dark:bg-green-950 dark:text-green-50'
                    : isWrongChoice
                      ? 'border-destructive bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50'
                      : ''
                }`}
                disabled={answered}
                onClick={() => onChoose(choice)}
                aria-label={`${index + 1}. ${choice}`}
              >
                <span aria-hidden="true" className="text-muted-foreground">
                  {index + 1}.
                </span>{' '}
                {choice}
              </Button>
            );
          })}
        </div>

        {answered && (
          <section
            aria-live="polite"
            className="bg-muted space-y-2 rounded-lg border p-4 leading-relaxed"
          >
            <p className="flex items-center gap-1 font-semibold">
              {correct ? 'Chính xác' : `Đáp án: ${card.answer}`}
              <SpeakButton text={card.phrase} loadAudio={loadAudio} />
            </p>
            {card.meaningVi && (
              <p>
                <span className="text-muted-foreground">Nghĩa:</span> {card.meaningVi}
              </p>
            )}
            {card.contextEn && (
              <p>
                <span className="text-muted-foreground">Trong cuộc họp:</span> {card.contextEn}
              </p>
            )}
          </section>
        )}

        {answered && (
          <div>
            <p className="mb-2 text-sm font-medium">Bạn nhớ cụm này thế nào?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((rating) => {
                const suggested = rating.value === (correct ? 3 : 1);
                return (
                  <Button
                    key={rating.value}
                    type="button"
                    variant={suggested ? 'default' : 'outline'}
                    className="min-h-11"
                    disabled={submitting}
                    onClick={() => onRate(rating.value)}
                  >
                    {rating.label}
                    {suggested && <span className="sr-only"> (gợi ý)</span>}
                  </Button>
                );
              })}
            </div>
            <p className="text-muted-foreground mt-2 text-sm">Nhấn Enter để dùng mức gợi ý.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReviewSummary({
  result,
  onRestart,
}: {
  result: ReviewResult;
  onRestart: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoàn thành phiên ôn</CardTitle>
        <CardDescription>Bạn vừa củng cố những cụm từ từ chính cuộc họp của mình.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-3">
          <div className="bg-muted rounded-lg p-4">
            <dt className="text-muted-foreground text-sm">Đúng</dt>
            <dd className="text-2xl font-semibold">{result.correct}</dd>
          </div>
          <div className="bg-muted rounded-lg p-4">
            <dt className="text-muted-foreground text-sm">Sai</dt>
            <dd className="text-2xl font-semibold">{result.incorrect}</dd>
          </div>
        </dl>
        <p>Còn {result.dueRemaining} thẻ đến hạn.</p>
        {result.dueRemaining > 0 && (
          <Button className="min-h-11" onClick={onRestart}>
            Ôn tiếp
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ReviewEmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chưa có thẻ nào đến hạn</CardTitle>
        <CardDescription>
          Lưu cụm từ ở debrief sau mỗi cuộc họp, chúng sẽ hiện ở đây đúng lúc cần ôn. Nếu bạn vừa ôn
          xong, hãy quay lại sau.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href="/sessions"
          className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          Xem Cuộc họp
        </Link>
      </CardContent>
    </Card>
  );
}

export function ReviewPage() {
  const { language, setLanguage, options } = useLanguage();
  const review = useReview(language);
  const [mode, setModeState] = useState<ReviewMode>('flip');
  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === 'quiz') setModeState('quiz');
    } catch {
      // Blocked storage: stay on flashcards.
    }
  }, []);
  const setMode = (next: ReviewMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // The choice just lasts until the page closes.
    }
  };

  useEffect(() => {
    if (mode !== 'quiz') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!review.card || review.submitting) return;
      const choiceIndex = Number(event.key) - 1;
      if (review.selectedChoice === null && choiceIndex >= 0 && choiceIndex < 4) {
        const choice = review.card.choices[choiceIndex];
        if (choice) review.choose(choice);
      } else if (event.key === 'Enter' && review.selectedChoice !== null) {
        event.preventDefault();
        void review.rate(review.isCorrect ? 3 : 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [review, mode]);

  let content;

  if (review.loading) {
    content = <p className="text-muted-foreground text-sm">Đang chuẩn bị thẻ ôn…</p>;
  } else if (review.error && review.total === 0) {
    content = (
      <p role="alert" className="text-destructive text-sm">
        {review.error}
      </p>
    );
  } else if (review.result) {
    content = <ReviewSummary result={review.result} onRestart={review.restart} />;
  } else if (!review.card) {
    content = <ReviewEmptyState />;
  } else {
    content = (
      <div className="space-y-3">
        {review.error && (
          <p role="alert" className="text-destructive text-sm">
            {review.error}
          </p>
        )}
        <div className="flex justify-center">
          <Segmented
            label="Kiểu ôn"
            options={MODES}
            value={mode}
            onChange={setMode}
            disabled={review.selectedChoice !== null || review.submitting}
          />
        </div>
        {mode === 'flip' ? (
          <FlashcardDeck
            card={review.card}
            position={review.cardIndex + 1}
            total={review.total}
            submitting={review.submitting}
            onRate={(rating) => void review.grade(rating)}
            loadAudio={client.tts.speak}
          />
        ) : (
          <ReviewSession
            card={review.card}
            position={review.cardIndex + 1}
            total={review.total}
            selectedChoice={review.selectedChoice}
            submitting={review.submitting}
            onChoose={review.choose}
            onRate={(rating) => void review.rate(rating)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Ôn tập"
        description="Ôn lại cụm từ từ chính các cuộc họp của bạn."
        action={<LanguageSwitcher options={options} value={language} onChange={setLanguage} />}
      />
      {content}
    </>
  );
}
