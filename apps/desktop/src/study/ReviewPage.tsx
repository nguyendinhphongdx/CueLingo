import type { ReviewAnswerRequest, ReviewCard } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cuelingo/ui/components/card';
import { DictationCard } from '@cuelingo/ui/components/dictation-card';
import { SpeakButton } from '@cuelingo/ui/components/speak-button';
import { FlashcardDeck } from '@cuelingo/ui/components/flashcard-deck';
import { Segmented } from '@cuelingo/ui/components/segmented';
import { useEffect, useState } from 'react';
import { studyApi } from './study-api';
import { type ReviewResult, useReview } from './use-review';
import { useLearnLanguage } from '../settings';

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

/** Flashcards by default; the choice is remembered on this device when storage is available. */
function useModeChoice() {
  const [mode, setModeState] = useState<ReviewMode>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'quiz' ? 'quiz' : 'flip';
    } catch {
      return 'flip';
    }
  });
  const setMode = (next: ReviewMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice just lasts until the page closes.
    }
  };
  return [mode, setMode] as const;
}

export function ReviewCardView({
  card,
  position,
  total,
  selectedChoice,
  submitting,
  onChoose,
  onRate,
  loadAudio = studyApi.speak,
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
    <Card className="w-full max-w-[560px] self-center shadow-none">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <p className="text-muted-foreground">
            {card.exercise === 'recognize'
              ? 'Chọn nghĩa đúng'
              : card.exercise === 'dictation'
                ? 'Nghe và gõ lại'
                : 'Điền cụm từ còn thiếu'}
          </p>
          <span className="font-medium tabular-nums" aria-label={`Thẻ ${position} trên ${total}`}>
            {position}/{total}
          </span>
        </div>
        <div
          className="bg-muted h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Tiến độ phiên ôn tập"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={position}
        >
          <div
            className="bg-foreground h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${(position / total) * 100}%` }}
          />
        </div>
        <CardTitle className="pt-4 text-2xl leading-relaxed tracking-tight">
          {card.exercise === 'dictation' ? 'Bạn nghe được cụm từ nào?' : card.prompt}
        </CardTitle>
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
                className={`min-h-11 h-auto justify-start whitespace-normal px-4 py-3 text-left shadow-none ${
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
                <span aria-hidden="true" className="text-muted-foreground tabular-nums">
                  {index + 1}.
                </span>
                {choice}
              </Button>
            );
          })}
        </div>

        {answered ? (
          <section aria-live="polite" className="bg-muted space-y-2 rounded-lg p-4 leading-relaxed">
            <p className="flex items-center gap-1 font-semibold">
              {correct ? 'Chính xác' : `Đáp án đúng: ${card.answer}`}
              <SpeakButton text={card.phrase} loadAudio={loadAudio} />
            </p>
            {card.meaningVi ? (
              <p>
                <span className="text-muted-foreground">Nghĩa:</span> {card.meaningVi}
              </p>
            ) : null}
            {card.contextEn ? (
              <p>
                <span className="text-muted-foreground">Trong cuộc họp:</span> {card.contextEn}
              </p>
            ) : null}
          </section>
        ) : null}

        {answered ? (
          <Button
            type="button"
            className="min-h-11 w-full"
            disabled={submitting}
            onClick={() => onRate(correct ? 3 : 1)}
          >
            Tiếp theo
          </Button>
        ) : null}

        {answered ? (
          <div>
            <p className="mb-2 text-sm font-medium">Hoặc chọn mức nhớ của bạn</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((rating) => {
                const suggested = rating.value === (correct ? 3 : 1);
                return (
                  <Button
                    key={rating.value}
                    type="button"
                    variant={suggested ? 'default' : 'outline'}
                    className="min-h-11 shadow-none"
                    disabled={submitting}
                    onClick={() => onRate(rating.value)}
                  >
                    {rating.label}
                    {suggested ? <span className="sr-only"> (gợi ý)</span> : null}
                  </Button>
                );
              })}
            </div>
            <p className="text-muted-foreground mt-2 text-sm">Nhấn Enter để dùng mức gợi ý.</p>
          </div>
        ) : null}
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
    <Card className="w-full max-w-[560px] self-center shadow-none">
      <CardHeader>
        <CardTitle>Hoàn thành phiên ôn</CardTitle>
        <p className="text-muted-foreground text-sm">
          Bạn vừa củng cố những cụm từ từ chính cuộc họp của mình.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 divide-x rounded-lg border">
          <div className="p-4">
            <dt className="text-muted-foreground text-sm">Đúng</dt>
            <dd className="text-2xl font-semibold tabular-nums">{result.correct}</dd>
          </div>
          <div className="p-4">
            <dt className="text-muted-foreground text-sm">Sai</dt>
            <dd className="text-2xl font-semibold tabular-nums">{result.incorrect}</dd>
          </div>
        </dl>
        <p>Còn {result.dueRemaining} thẻ đến hạn.</p>
        {result.dueRemaining > 0 ? (
          <Button className="min-h-11" onClick={onRestart}>
            Ôn tiếp
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ReviewEmptyState() {
  return (
    <Card className="w-full max-w-[560px] self-center shadow-none">
      <CardHeader>
        <CardTitle>Chưa có thẻ nào đến hạn</CardTitle>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Lưu cụm từ ở debrief sau mỗi cuộc họp, chúng sẽ hiện ở đây đúng lúc cần ôn. Nếu bạn vừa ôn
          xong, hãy quay lại sau.
        </p>
      </CardHeader>
    </Card>
  );
}

export function ReviewPage() {
  const review = useReview(useLearnLanguage().language);
  const [mode, setMode] = useModeChoice();

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

  if (review.loading) {
    return <p className="text-muted-foreground text-sm">Đang chuẩn bị thẻ ôn…</p>;
  }
  if (review.error && review.total === 0) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-destructive text-sm">Không thể tải thẻ ôn.</p>
        <Button variant="outline" onClick={review.restart}>
          Thử lại
        </Button>
      </div>
    );
  }
  if (review.result) return <ReviewSummary result={review.result} onRestart={review.restart} />;
  if (!review.card) return <ReviewEmptyState />;

  return (
    <div className="flex flex-col gap-3">
      {review.error ? (
        <div className="flex items-center justify-between gap-3" role="alert">
          <p className="text-destructive text-sm">Không thể lưu kết quả. Hãy thử lại.</p>
          <Button
            variant="outline"
            size="sm"
            disabled={review.submitting}
            onClick={() => void review.rate(review.isCorrect ? 3 : 1)}
          >
            Thử lại
          </Button>
        </div>
      ) : null}
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
          loadAudio={studyApi.speak}
        />
      ) : (
        <ReviewCardView
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
