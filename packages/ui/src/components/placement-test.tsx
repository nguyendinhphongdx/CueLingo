import { Check, Volume2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './button';
import { useSpeaker } from './speak-button';

/** What the test needs of a passage; the clients pass their shared-contract objects straight in. */
export interface PlacementTestPassage {
  id: string;
  text: string;
  question: string;
  choices: string[];
}

export interface PlacementTestResult {
  correct: number;
  total: number;
  listeningLevel: string;
  assistDefault: number;
  answers: Array<{ passageId: string; correctChoice: number }>;
}

const LEVEL_NAMES: Record<string, string> = {
  a2: 'Sơ cấp (A2)',
  b1: 'Trung cấp (B1)',
  b2: 'Trung cao (B2)',
  c1: 'Cao cấp (C1)',
};

const ASSIST_NAMES: Record<number, string> = {
  4: '4 · Đầy đủ',
  3: '3 · Gợi ý',
  1: '1 · Tối thiểu',
  0: '0 · Ẩn',
};

export const describeLevel = (level: string) => LEVEL_NAMES[level] ?? level.toUpperCase();
export const describeAssist = (level: number) => ASSIST_NAMES[level] ?? String(level);

/**
 * Listening placement: one passage at a time is read aloud, the person picks what it meant, and at the
 * end the result sets their level and starting assist level. Used on web and desktop alike.
 */
export function PlacementTest({
  passages,
  loadAudio,
  onSubmit,
  onDone,
}: {
  passages: PlacementTestPassage[];
  loadAudio: (text: string) => Promise<Blob>;
  onSubmit(answers: Array<{ passageId: string; choice: number }>): Promise<PlacementTestResult>;
  /** Called when the person closes the result. */
  onDone?(): void;
}) {
  const { status, play } = useSpeaker(loadAudio);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Array<{ passageId: string; choice: number }>>([]);
  const [result, setResult] = useState<PlacementTestResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const passage = passages[index];
  const last = index === passages.length - 1;

  // Each passage is read once as it appears; the person can ask to hear it again.
  useEffect(() => {
    if (passage && !result) void play(passage.text);
  }, [index, result]);

  async function submit(all: Array<{ passageId: string; choice: number }>) {
    setSaving(true);
    setFailed(false);
    try {
      setResult(await onSubmit(all));
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (picked === null || !passage) return;
    const all = [...answers, { passageId: passage.id, choice: picked }];
    setAnswers(all);
    setPicked(null);
    if (last) void submit(all);
    else setIndex(index + 1);
  }

  if (result) {
    return (
      <div className="space-y-5">
        <div className="bg-card rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">Kết quả</p>
          <p className="mt-1 text-2xl font-semibold">{describeLevel(result.listeningLevel)}</p>
          <p className="mt-1 text-sm">
            Đúng {result.correct}/{result.total} đoạn. Mức hỗ trợ mặc định đã đặt là{' '}
            <span className="font-medium">{describeAssist(result.assistDefault)}</span>; bạn đổi lại
            được bất cứ lúc nào.
          </p>
        </div>
        <ul className="space-y-2">
          {passages.map((item, i) => {
            const given = answers.find((a) => a.passageId === item.id)?.choice;
            const right = result.answers.find((a) => a.passageId === item.id)?.correctChoice;
            const ok = given !== undefined && given === right;
            return (
              <li key={item.id} className="bg-card rounded-lg border px-4 py-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  {ok ? (
                    <Check aria-hidden="true" className="size-4 text-emerald-600" />
                  ) : (
                    <X aria-hidden="true" className="size-4 text-red-600" />
                  )}
                  Đoạn {i + 1}
                </p>
                <p className="text-muted-foreground mt-1">{item.text}</p>
                {!ok && right !== undefined ? (
                  <p className="mt-1">Đáp án: {item.choices[right]}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {onDone ? (
          <Button className="cursor-pointer" onClick={onDone}>
            Xong
          </Button>
        ) : null}
      </div>
    );
  }

  if (!passage) return null;

  return (
    <div className="bg-card space-y-5 rounded-xl border p-5">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Đoạn {index + 1}/{passages.length}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="lg"
          className="cursor-pointer"
          onClick={() => void play(passage.text)}
          aria-busy={status === 'loading'}
        >
          <Volume2 aria-hidden="true" className="size-4" />
          {status === 'loading' ? 'Đang tải…' : status === 'playing' ? 'Đang đọc…' : 'Nghe lại'}
        </Button>
      </div>
      {status === 'error' ? (
        <p role="alert" className="text-destructive text-sm">
          Không phát được âm thanh. Bấm &quot;Nghe lại&quot; để thử lại.
        </p>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-base font-medium">{passage.question}</legend>
        {passage.choices.map((choice, i) => (
          <label
            key={choice}
            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 text-sm ${
              picked === i ? 'border-primary bg-primary/10' : 'hover:bg-accent'
            }`}
          >
            <input
              type="radio"
              name={`passage-${passage.id}`}
              checked={picked === i}
              onChange={() => setPicked(i)}
              className="accent-[var(--primary)]"
            />
            {choice}
          </label>
        ))}
      </fieldset>
      {failed ? (
        <p role="alert" className="text-destructive text-sm">
          Không lưu được kết quả. Bấm lại để thử lần nữa.
        </p>
      ) : null}
      <Button className="cursor-pointer" disabled={picked === null || saving} onClick={next}>
        {last ? (saving ? 'Đang chấm…' : 'Nộp bài') : 'Tiếp'}
      </Button>
    </div>
  );
}
