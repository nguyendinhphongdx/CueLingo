import { Check, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  describeGoalLevel,
  LESSON_AI_NOTE,
  LESSON_PREPARING_TEXT,
  PRACTICE_PRIVACY_NOTE,
  REGISTER_LABELS,
  REPORT_REASONS,
  shuffledOrder,
  VERDICT_LABELS,
  voiceForSpeaker,
  type DialogueVoice,
  type ReportReason,
} from '../lib/goal-lesson';
import { cn } from '../lib/utils';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent } from './card';
import { NoticeStrip } from './notice-strip';
import { SpeakButton } from './speak-button';

/** Structurally the same as `LessonView`, `PracticeFeedback` and `QuizResult` in `@cuelingo/shared`. */
export interface LessonViewData {
  lessonKey: string;
  titleVi: string;
  level: string;
  situation: {
    descriptionVi: string;
    keyPhrases: Array<{ en: string; meaningVi: string; register: string }>;
  };
  dialogue: {
    roles: { a: string; b: string };
    turns: Array<{ speaker: string; en: string; vi: string }>;
  };
  practice: {
    prompts: Array<{ taskVi: string; targetPhrase: string; hintEn?: string | undefined }>;
  };
  quiz: { questions: Array<{ kind: string; prompt: string; options: string[] }> };
  examples: Array<{ en: string; vi: string; term: string }>;
  bestCorrect: number | null;
}

export interface PracticeFeedbackData {
  verdict: string;
  grammarVi?: string | undefined;
  better: string;
  register: string;
  registerNoteVi?: string | undefined;
}

export interface QuizResultData {
  correct: number;
  total: number;
  passed: boolean;
  passMark: number;
  bestCorrect: number;
  results: Array<{
    question: number;
    correct: boolean;
    answerIndex: number;
    explanationVi: string;
  }>;
  phrasesAdded: number;
}

export interface GoalLessonViewProps {
  /** Undefined while the lesson is being opened or made. */
  lesson: LessonViewData | undefined;
  loading?: boolean;
  /** Vietnamese message when the lesson could not be opened or made. */
  error?: string | null;
  onRetry?: () => void;
  onBack?: () => void;
  /** Fetches the audio of one line; the voice is fixed by the speaker so the audio is shared and cached. */
  loadAudio: (text: string, voice: DialogueVoice) => Promise<Blob>;
  /** Rejects with an `Error` whose message is Vietnamese when the feedback could not be made. */
  onPractice: (promptIndex: number, sentence: string) => Promise<PracticeFeedbackData>;
  onSubmitQuiz: (answers: Array<{ question: number; choice: number }>) => Promise<QuizResultData>;
  onReport: (reason: ReportReason) => Promise<void>;
  className?: string;
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PracticeBox({
  index,
  prompt,
  onPractice,
}: {
  index: number;
  prompt: LessonViewData['practice']['prompts'][number];
  onPractice: GoalLessonViewProps['onPractice'];
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<PracticeFeedbackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boxId = `practice-${index}`;

  async function send() {
    const sentence = text.trim();
    if (!sentence || busy) return;
    setBusy(true);
    setError(null);
    try {
      setFeedback(await onPractice(index, sentence));
    } catch (failure) {
      setFeedback(null);
      setError(messageOf(failure, 'Chưa góp ý được câu này. Thử lại sau.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <Card className="gap-3">
        <CardContent className="flex flex-col gap-3">
          <div>
            <p className="font-medium">{prompt.taskVi}</p>
            <p className="text-muted-foreground text-body-sm">
              Thử dùng: <span className="text-foreground font-medium">{prompt.targetPhrase}</span>
              {prompt.hintEn ? ` · Gợi ý: ${prompt.hintEn}` : ''}
            </p>
          </div>
          <label htmlFor={boxId} className="sr-only">
            {`Câu tiếng Anh của bạn cho: ${prompt.taskVi}`}
          </label>
          <textarea
            id={boxId}
            value={text}
            maxLength={300}
            rows={2}
            disabled={busy}
            onChange={(event) => setText(event.target.value)}
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            placeholder="Gõ câu tiếng Anh của bạn"
          />
          <p className="text-muted-foreground text-caption">{PRACTICE_PRIVACY_NOTE}</p>
          <div>
            <Button size="sm" disabled={busy || !text.trim()} onClick={() => void send()}>
              {busy ? 'Đang góp ý…' : 'Nhận góp ý'}
            </Button>
          </div>
          {error ? <NoticeStrip tone="error">{error}</NoticeStrip> : null}
          {feedback ? (
            <div
              role="status"
              className="bg-muted/50 flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm"
            >
              <Badge
                variant={
                  feedback.verdict === 'ok'
                    ? 'success'
                    : feedback.verdict === 'wrong'
                      ? 'destructive'
                      : 'warning'
                }
                className="w-fit"
              >
                {VERDICT_LABELS[feedback.verdict] ?? feedback.verdict}
              </Badge>
              {feedback.grammarVi ? <p>{feedback.grammarVi}</p> : null}
              <p>
                <span className="text-muted-foreground">Câu tự nhiên hơn: </span>
                <span className="font-medium">{feedback.better}</span>
              </p>
              <p className="text-muted-foreground">
                {`Mức trang trọng: ${REGISTER_LABELS[feedback.register] ?? feedback.register}`}
                {feedback.registerNoteVi ? ` · ${feedback.registerNoteVi}` : ''}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}

function Quiz({
  questions,
  bestCorrect,
  onSubmit,
}: {
  questions: LessonViewData['quiz']['questions'];
  bestCorrect: number | null;
  onSubmit: GoalLessonViewProps['onSubmitQuiz'];
}) {
  const [attempt, setAttempt] = useState(0);
  // Option index chosen, by question; the index is the server's, whatever order is shown.
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResultData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A retake shows the options in another order; the first sitting shows them as written.
  const orders = useMemo(
    () =>
      questions.map((question, index) =>
        attempt === 0
          ? question.options.map((_, i) => i)
          : shuffledOrder(question.options.length, attempt * 31 + index),
      ),
    [questions, attempt],
  );
  const complete = questions.every((_, index) => picks[index] !== undefined);

  async function submit() {
    if (!complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        await onSubmit(questions.map((_, question) => ({ question, choice: picks[question]! }))),
      );
    } catch (failure) {
      setError(messageOf(failure, 'Chưa nộp được bài kiểm tra. Thử lại sau.'));
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setAttempt(attempt + 1);
    setPicks({});
    setResult(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {bestCorrect !== null || result ? (
        <p className="text-muted-foreground text-body-sm">
          {`Điểm cao nhất: ${Math.max(bestCorrect ?? 0, result?.bestCorrect ?? 0)}/${questions.length}`}
        </p>
      ) : null}
      <ol className="flex flex-col gap-4">
        {questions.map((question, index) => {
          const graded = result?.results.find((entry) => entry.question === index);
          return (
            <li key={`${attempt}-${index}`}>
              <fieldset className="flex flex-col gap-2" disabled={busy || result !== null}>
                <legend className="mb-1 font-medium">{`${index + 1}. ${question.prompt}`}</legend>
                {orders[index]!.map((optionIndex) => {
                  const picked = picks[index] === optionIndex;
                  const isAnswer = graded?.answerIndex === optionIndex;
                  return (
                    <label
                      key={optionIndex}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 text-sm',
                        picked && !graded && 'border-primary bg-primary/5',
                        graded && isAnswer && 'border-success bg-success/8',
                        graded && picked && !isAnswer && 'border-destructive bg-destructive/8',
                      )}
                    >
                      <input
                        type="radio"
                        name={`quiz-${attempt}-${index}`}
                        checked={picked}
                        onChange={() => setPicks({ ...picks, [index]: optionIndex })}
                      />
                      <span>{question.options[optionIndex]}</span>
                      {graded && isAnswer ? (
                        <Check aria-label="Đáp án đúng" className="text-success ml-auto size-4" />
                      ) : null}
                      {graded && picked && !isAnswer ? (
                        <X aria-label="Bạn chọn sai" className="text-destructive ml-auto size-4" />
                      ) : null}
                    </label>
                  );
                })}
                {graded ? (
                  <p className="text-muted-foreground text-body-sm">{graded.explanationVi}</p>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {error ? <NoticeStrip tone="error">{error}</NoticeStrip> : null}
      {result ? (
        <div className="flex flex-col gap-2">
          <NoticeStrip tone={result.passed ? 'info' : 'warning'}>
            <p className="font-medium">
              {`Đúng ${result.correct}/${result.total}. ${
                result.passed
                  ? 'Bạn đã hoàn thành bài này.'
                  : `Cần đúng ${result.passMark}/${result.total} để hoàn thành, làm lại được không giới hạn.`
              }`}
            </p>
            {result.phrasesAdded > 0 ? (
              <p className="text-body-sm">{`Đã thêm ${result.phrasesAdded} cụm vào Kho cụm từ để ôn.`}</p>
            ) : null}
          </NoticeStrip>
          <div>
            <Button variant="outline" size="sm" onClick={retake}>
              Làm lại
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div>
            <Button disabled={!complete || busy} onClick={() => void submit()}>
              {busy ? 'Đang chấm…' : 'Nộp bài'}
            </Button>
          </div>
          <p className="text-muted-foreground text-caption">
            Khi nộp, các cụm chính của bài được thêm vào Kho cụm từ để ôn, và mỗi câu được tính vào
            lịch ôn.
          </p>
        </div>
      )}
    </div>
  );
}

function ReportBox({ onReport }: { onReport: GoalLessonViewProps['onReport'] }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('english');
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (state === 'sent') {
    return (
      <p className="text-muted-foreground text-body-sm">
        Cảm ơn bạn đã báo, chúng tôi sẽ xem lại bài này.
      </p>
    );
  }
  if (!open) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Báo bài sai
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="report-reason" className="sr-only">
        Lý do báo bài sai
      </label>
      <select
        id="report-reason"
        value={reason}
        disabled={state === 'busy'}
        onChange={(event) => setReason(event.target.value as ReportReason)}
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
      >
        {REPORT_REASONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          setError(null);
          try {
            await onReport(reason);
            setState('sent');
          } catch (failure) {
            setState('idle');
            setError(messageOf(failure, 'Chưa gửi được báo cáo. Thử lại sau.'));
          }
        }}
      >
        Gửi báo cáo
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Huỷ
      </Button>
      {error ? <span className="text-destructive text-body-sm">{error}</span> : null}
    </div>
  );
}

/**
 * One goal lesson in its four parts: the situation with phrases, a model dialogue with audio, the
 * person's own sentences with feedback, and the quiz. Web and desktop both draw it. Presentation
 * only: the caller opens the lesson, plays audio, asks for feedback and submits the quiz.
 */
export function GoalLessonView({
  lesson,
  loading = false,
  error = null,
  onRetry,
  onBack,
  loadAudio,
  onPractice,
  onSubmitQuiz,
  onReport,
  className,
}: GoalLessonViewProps) {
  const loaders = useMemo(
    () => ({
      Kore: (text: string) => loadAudio(text, 'Kore'),
      Puck: (text: string) => loadAudio(text, 'Puck'),
    }),
    [loadAudio],
  );

  if (error) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <NoticeStrip
          tone="error"
          action={
            onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry}>
                Thử lại
              </Button>
            ) : undefined
          }
        >
          {error}
        </NoticeStrip>
        {onBack ? (
          <div>
            <Button variant="ghost" size="sm" onClick={onBack}>
              Quay lại lộ trình
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
  if (!lesson || loading) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        {LESSON_PREPARING_TEXT}
      </p>
    );
  }

  const roleName = (speaker: string) =>
    speaker === 'b' ? lesson.dialogue.roles.b : lesson.dialogue.roles.a;

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <header className="flex flex-col gap-1">
        {onBack ? (
          <div>
            <Button variant="ghost" size="sm" onClick={onBack}>
              Quay lại lộ trình
            </Button>
          </div>
        ) : null}
        <h1 className="text-title">{lesson.titleVi}</h1>
        <p className="text-muted-foreground text-body-sm">
          {`${describeGoalLevel(lesson.level)} · ${LESSON_AI_NOTE}`}
        </p>
      </header>

      <Section id="lesson-situation" title="1. Tình huống và mẫu câu">
        <p>{lesson.situation.descriptionVi}</p>
        <ul className="flex flex-col gap-2">
          {lesson.situation.keyPhrases.map((phrase) => (
            <li
              key={phrase.en}
              className="bg-card flex items-center gap-3 rounded-lg border px-4 py-2"
            >
              <div className="min-w-0 grow">
                <p className="font-medium">{phrase.en}</p>
                <p className="text-muted-foreground text-body-sm">{phrase.meaningVi}</p>
              </div>
              <Badge variant="outline">{REGISTER_LABELS[phrase.register] ?? phrase.register}</Badge>
              <SpeakButton text={phrase.en} loadAudio={loaders.Kore} scope="Kore" />
            </li>
          ))}
        </ul>
        {lesson.examples.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="font-medium">Ví dụ với thuật ngữ của bạn</h3>
            <ul className="flex flex-col gap-2">
              {lesson.examples.map((example) => (
                <li key={example.en} className="bg-muted/50 rounded-lg border px-4 py-2 text-sm">
                  <p>{example.en}</p>
                  <p className="text-muted-foreground">{example.vi}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section id="lesson-dialogue" title="2. Hội thoại mẫu">
        <ol className="flex flex-col gap-2">
          {lesson.dialogue.turns.map((turn, index) => {
            const voice = voiceForSpeaker(turn.speaker);
            return (
              <li
                key={index}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-4 py-2',
                  turn.speaker === 'b' ? 'bg-primary/5' : 'bg-card',
                )}
              >
                <div className="min-w-0 grow">
                  <p className="text-muted-foreground text-caption">{roleName(turn.speaker)}</p>
                  <p className="font-medium">{turn.en}</p>
                  <p className="text-muted-foreground text-body-sm">{turn.vi}</p>
                </div>
                <SpeakButton text={turn.en} loadAudio={loaders[voice]} scope={voice} />
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="lesson-practice" title="3. Luyện câu của bạn">
        <ul className="flex flex-col gap-3">
          {lesson.practice.prompts.map((prompt, index) => (
            <PracticeBox key={index} index={index} prompt={prompt} onPractice={onPractice} />
          ))}
        </ul>
      </Section>

      <Section id="lesson-quiz" title="4. Kiểm tra cuối bài">
        <Quiz
          questions={lesson.quiz.questions}
          bestCorrect={lesson.bestCorrect}
          onSubmit={onSubmitQuiz}
        />
      </Section>

      <ReportBox onReport={onReport} />
    </div>
  );
}
