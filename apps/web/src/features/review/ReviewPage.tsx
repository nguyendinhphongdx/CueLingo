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
import Link from 'next/link';
import { useEffect } from 'react';
import { type ReviewResult, useReview } from './use-review';

const RATINGS = [
  { value: 1, label: 'Lại' },
  { value: 2, label: 'Khó' },
  { value: 3, label: 'Được' },
  { value: 4, label: 'Dễ' },
] as const;

export function ReviewSession({
  card,
  position,
  total,
  selectedChoice,
  submitting,
  onChoose,
  onRate,
}: {
  card: ReviewCard;
  position: number;
  total: number;
  selectedChoice: string | null;
  submitting: boolean;
  onChoose: (choice: string) => void;
  onRate: (rating: ReviewAnswerRequest['rating']) => void;
}) {
  const answered = selectedChoice !== null;
  const correct = selectedChoice === card.answer;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardDescription>
            {card.exercise === 'recognize' ? 'Chọn nghĩa đúng' : 'Chọn cụm từ còn thiếu'}
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
        <CardTitle className="pt-5 text-2xl leading-relaxed">{card.prompt}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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
            <p className="font-semibold">{correct ? 'Chính xác' : `Đáp án: ${card.answer}`}</p>
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
        <CardTitle>Hôm nay bạn đã ôn xong</CardTitle>
        <CardDescription>
          Không còn thẻ nào đến hạn. Những cụm mới từ cuộc họp tiếp theo sẽ xuất hiện ở đây.
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
  const review = useReview();

  useEffect(() => {
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
  }, [review]);

  if (review.loading) return <p className="text-muted-foreground text-sm">Đang chuẩn bị thẻ ôn…</p>;
  if (review.error && review.total === 0) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {review.error}
      </p>
    );
  }
  if (review.result) return <ReviewSummary result={review.result} onRestart={review.restart} />;
  if (!review.card) return <ReviewEmptyState />;

  return (
    <div className="space-y-3">
      {review.error && (
        <p role="alert" className="text-destructive text-sm">
          {review.error}
        </p>
      )}
      <ReviewSession
        card={review.card}
        position={review.cardIndex + 1}
        total={review.total}
        selectedChoice={review.selectedChoice}
        submitting={review.submitting}
        onChoose={review.choose}
        onRate={(rating) => void review.rate(rating)}
      />
    </div>
  );
}
