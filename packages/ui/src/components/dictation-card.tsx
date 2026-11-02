import { Check, Snail, Volume2, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isSameText, markAnswerWords } from '../lib/dictation';
import { usesSpaces } from '../lib/text-units';
import { Button } from './button';
import { useSpeaker } from './speak-button';

/** What the card needs to know: the id (to reset between cards), the text to read, the text to type. */
export interface DictationCardData {
  itemId: string;
  prompt: string;
  answer: string;
}

export interface DictationResult {
  correct: boolean;
  typed: string;
  responseMs: number;
}

/**
 * Listen-and-type: the phrase is read aloud, the person types what they heard. Grading is local and
 * forgiving about case and punctuation. The parent shows the meaning and the rating buttons once
 * `onAnswer` fires, exactly as for the other card types.
 */
export function DictationCard({
  card,
  loadAudio,
  onAnswer,
  language = 'en',
}: {
  card: DictationCardData;
  /** Language of the phrase; decides whether answers are compared by word or by character. */
  language?: string;
  loadAudio: (text: string) => Promise<Blob>;
  onAnswer(result: DictationResult): void;
}) {
  const { status, play } = useSpeaker(loadAudio);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<DictationResult | null>(null);
  const started = useRef(performance.now());
  const input = useRef<HTMLInputElement>(null);

  // Read it once as the card appears; the person can ask again.
  useEffect(() => {
    void play(card.prompt);
    input.current?.focus();
  }, [card.itemId]);

  function finish(text: string, correct: boolean) {
    if (result) return;
    const outcome = {
      correct,
      typed: text,
      responseMs: Math.round(performance.now() - started.current),
    };
    setResult(outcome);
    onAnswer(outcome);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (typed.trim()) finish(typed, isSameText(typed, card.answer, language));
  }

  const gap = usesSpaces(language) ? 'mr-1.5' : '';
  const words = result ? markAnswerWords(result.typed, card.answer, language) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="lg"
          className="cursor-pointer"
          onClick={() => void play(card.prompt)}
          aria-busy={status === 'loading'}
        >
          <Volume2 aria-hidden="true" className="size-4" />
          {status === 'loading' ? 'Đang tải…' : status === 'playing' ? 'Đang đọc…' : 'Nghe'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="cursor-pointer"
          onClick={() => void play(card.prompt, 0.75)}
        >
          <Snail aria-hidden="true" className="size-4" />
          Nghe chậm
        </Button>
      </div>
      {status === 'error' ? (
        <p role="alert" className="text-destructive text-sm">
          Không phát được âm thanh. Bạn vẫn gõ được: bấm &quot;Nghe&quot; để thử lại.
        </p>
      ) : null}

      {result ? (
        <div aria-live="polite" className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            {result.correct ? (
              <Check aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <X aria-hidden="true" className="size-4 text-red-600 dark:text-red-400" />
            )}
            {result.correct ? 'Chính xác' : 'Chưa đúng, đáp án là:'}
          </p>
          <p className="text-xl leading-relaxed">
            {words.map(({ word, state }, index) => (
              <span
                key={`${index}-${word}`}
                className={
                  state === 'ok'
                    ? gap
                    : `${gap} text-red-600 underline decoration-wavy underline-offset-4 dark:text-red-400`
                }
              >
                {word}
              </span>
            ))}
          </p>
          {result.typed && !result.correct ? (
            <p className="text-muted-foreground text-sm">Bạn gõ: {result.typed}</p>
          ) : null}
        </div>
      ) : (
        <form className="flex flex-wrap gap-2" onSubmit={submit}>
          <input
            ref={input}
            aria-label="Gõ cụm từ bạn nghe được"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="border-input bg-background focus-visible:ring-ring min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none"
            placeholder="Gõ những gì bạn nghe được"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          <Button type="submit" className="cursor-pointer" disabled={!typed.trim()}>
            Kiểm tra
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer"
            onClick={() => finish('', false)}
          >
            Không nghe ra
          </Button>
        </form>
      )}
    </div>
  );
}
