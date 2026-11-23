import { useState } from 'react';
import {
  deadlineLabel,
  describeGoalLevel,
  LESSON_AI_NOTE,
  LESSON_STATUS_LABELS,
} from '../lib/goal-lesson';
import { cn } from '../lib/utils';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent } from './card';
import { ConfirmDialog } from './confirm-dialog';
import { EmptyState } from './empty-state';
import { NoticeStrip } from './notice-strip';
import { Progress } from './progress';

/** Structurally the same as `CourseSummary`, `CourseNextUp` and `CourseList` in `@cuelingo/shared` (ui does not depend on it). */
export interface PathCourse {
  sessionId: string;
  headline: string;
  lessonCount: number;
  doneCount: number;
  progressPct: number;
  unsavedCount: number;
}
export interface PathData {
  courses: PathCourse[];
  nextUp: { sessionId: string; headline: string; phrase: string; saved: boolean } | null;
}

/** Structurally the same as `Goal` and `GoalList` in `@cuelingo/shared`: goals picked from the catalog. */
export interface PathGoalLesson {
  lessonKey: string;
  titleVi: string;
  status: string;
  bestCorrect: number | null;
}
export interface PathGoal {
  id: string;
  titleVi: string;
  level: string;
  deadline: string | null;
  lessonCount: number;
  doneCount: number;
  progressPct: number;
  lessons: PathGoalLesson[];
}
export interface PathGoals {
  goals: PathGoal[];
  nextUp: { goalId: string; goalTitleVi: string; lessonKey: string; lessonTitleVi: string } | null;
}

export interface LearningPathPanelProps {
  /** Undefined while loading. */
  data: PathData | undefined;
  loading?: boolean;
  /** Vietnamese message when the courses could not be loaded; the other tabs keep working. */
  error?: string | null;
  /** Vietnamese message when an action (start) failed; the list stays so the person can try again. */
  actionError?: string | null;
  /** Session id of the course whose start or queue is being fetched. */
  busySessionId?: string | null;
  /** Add the phrases of the course to the Phrase Bank, then study. */
  onStart: (sessionId: string) => void;
  /** Study the next sitting of a course whose phrases are already saved. */
  onContinue: (sessionId: string) => void;
  /** Goals next to the meeting courses (goal lessons). Leave out where goals are not offered. */
  goals?: PathGoals;
  /** Open a lesson of a goal; it is made on the first open, so this can take a while. */
  onOpenLesson?: (goalId: string, lessonKey: string) => void;
  onAddGoal?: () => void;
  onEditGoal?: (goalId: string) => void;
  onRemoveGoal?: (goalId: string) => void;
  /** Vietnamese message when a goal action failed. */
  goalError?: string | null;
  className?: string;
}

/** The most goals a person can have (`GOAL_MAX` in `@cuelingo/shared`). */
const MAX_GOALS = 3;

const isFinished = (course: PathCourse) => course.progressPct === 100;

function CourseAction({
  course,
  busy,
  onStart,
  onContinue,
}: {
  course: PathCourse;
  busy: boolean;
  onStart: (sessionId: string) => void;
  onContinue: (sessionId: string) => void;
}) {
  if (isFinished(course)) return <Badge variant="success">Đã xong</Badge>;
  if (course.unsavedCount > 0) {
    return (
      <Button size="sm" disabled={busy} onClick={() => onStart(course.sessionId)}>
        {`Bắt đầu khoá · thêm ${course.unsavedCount} cụm vào Kho cụm từ`}
      </Button>
    );
  }
  return (
    <Button size="sm" disabled={busy} onClick={() => onContinue(course.sessionId)}>
      Học tiếp
    </Button>
  );
}

function GoalCard({
  goal,
  onOpenLesson,
  onEdit,
  onRemove,
}: {
  goal: PathGoal;
  onOpenLesson?: (goalId: string, lessonKey: string) => void;
  onEdit?: (goalId: string) => void;
  onRemove?: (goal: PathGoal) => void;
}) {
  const deadline = deadlineLabel(goal.deadline);
  return (
    <Card className="gap-3">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{goal.titleVi}</p>
            <p className="text-muted-foreground text-caption">
              {[
                `${goal.doneCount}/${goal.lessonCount} bài xong`,
                describeGoalLevel(goal.level),
                deadline,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="flex gap-1">
            {onEdit ? (
              <Button variant="ghost" size="sm" onClick={() => onEdit(goal.id)}>
                Sửa
              </Button>
            ) : null}
            {onRemove ? (
              <Button variant="ghost" size="sm" onClick={() => onRemove(goal)}>
                Xoá
              </Button>
            ) : null}
          </div>
        </div>
        <Progress
          value={goal.progressPct / 100}
          label={`Tiến độ mục tiêu ${goal.titleVi}`}
          valueText={`${goal.progressPct}% hoàn thành`}
        />
        <ol className="flex flex-col gap-1">
          {goal.lessons.map((lesson, index) => (
            <li key={lesson.lessonKey}>
              <button
                type="button"
                disabled={!onOpenLesson}
                onClick={() => onOpenLesson?.(goal.id, lesson.lessonKey)}
                className="hover:bg-accent focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="text-muted-foreground w-5 shrink-0 tabular-nums">{index + 1}</span>
                <span className="min-w-0 grow truncate">{lesson.titleVi}</span>
                <Badge variant={lesson.status === 'done' ? 'success' : 'outline'}>
                  {LESSON_STATUS_LABELS[lesson.status] ?? lesson.status}
                </Badge>
              </button>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/**
 * The learning path: what to do next, the goals the person picked and the courses made from their
 * meetings, with progress. Web and desktop both draw it. Presentation only: the caller fetches and acts.
 */
export function LearningPathPanel({
  data,
  loading = false,
  error = null,
  actionError = null,
  busySessionId = null,
  onStart,
  onContinue,
  goals,
  onOpenLesson,
  onAddGoal,
  onEditGoal,
  onRemoveGoal,
  goalError = null,
  className,
}: LearningPathPanelProps) {
  const [removing, setRemoving] = useState<PathGoal | null>(null);
  if (error) return <NoticeStrip tone="error">{error}</NoticeStrip>;
  if (!data || loading) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Đang tải lộ trình…
      </p>
    );
  }
  const goalList = goals?.goals ?? [];
  if (data.courses.length === 0 && goalList.length === 0) {
    return (
      <EmptyState
        title="Chưa có khoá nào"
        description={
          onAddGoal
            ? 'Chọn một mục tiêu để có bài học riêng, hoặc học từ debrief của cuộc họp khi có ít nhất 3 cụm từ để học.'
            : 'Khoá học được tạo từ debrief của cuộc họp, khi có ít nhất 3 cụm từ để học.'
        }
        action={onAddGoal ? <Button onClick={onAddGoal}>Chọn mục tiêu</Button> : undefined}
      />
    );
  }

  const nextCourse = data.nextUp
    ? data.courses.find((course) => course.sessionId === data.nextUp?.sessionId)
    : undefined;

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {actionError ? <NoticeStrip tone="error">{actionError}</NoticeStrip> : null}
      {(goals?.nextUp && onOpenLesson) || (data.nextUp && nextCourse) ? (
        <section aria-labelledby="path-next-up" className="flex flex-col gap-2">
          <h2 id="path-next-up" className="text-heading">
            Việc nên làm tiếp
          </h2>
          {goals?.nextUp && onOpenLesson ? (
            <Card className="gap-3">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{goals.nextUp.lessonTitleVi}</p>
                  <p className="text-muted-foreground text-body-sm truncate">
                    {goals.nextUp.goalTitleVi}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => onOpenLesson(goals.nextUp!.goalId, goals.nextUp!.lessonKey)}
                >
                  Học bài này
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {data.nextUp && nextCourse ? (
            <Card className="gap-3">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{data.nextUp.phrase}</p>
                  <p className="text-muted-foreground text-body-sm truncate">
                    {data.nextUp.headline}
                  </p>
                </div>
                <CourseAction
                  course={nextCourse}
                  busy={busySessionId === nextCourse.sessionId}
                  onStart={onStart}
                  onContinue={onContinue}
                />
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {goals ? (
        <section aria-labelledby="path-goals" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="path-goals" className="text-heading">
              Mục tiêu của bạn
            </h2>
            {onAddGoal && goalList.length < MAX_GOALS ? (
              <Button variant="outline" size="sm" onClick={onAddGoal}>
                Thêm mục tiêu
              </Button>
            ) : null}
          </div>
          {goalError ? <NoticeStrip tone="error">{goalError}</NoticeStrip> : null}
          <p className="text-muted-foreground text-body-sm">{LESSON_AI_NOTE}</p>
          {goalList.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Chưa có mục tiêu nào. Chọn một mục tiêu để có 6 bài học riêng.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {goalList.map((goal) => (
                <li key={goal.id}>
                  <GoalCard
                    goal={goal}
                    onOpenLesson={onOpenLesson}
                    onEdit={onEditGoal}
                    onRemove={onRemoveGoal ? setRemoving : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {data.courses.length > 0 ? (
        <section aria-labelledby="path-courses" className="flex flex-col gap-2">
          <h2 id="path-courses" className="text-heading">
            Khoá của bạn
          </h2>
          <ul className="flex flex-col gap-3">
            {data.courses.map((course) => (
              <li key={course.sessionId}>
                <Card className="gap-3">
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{course.headline}</p>
                        <p className="text-muted-foreground text-caption">
                          {`${course.doneCount}/${course.lessonCount} bài xong`}
                        </p>
                      </div>
                      <CourseAction
                        course={course}
                        busy={busySessionId === course.sessionId}
                        onStart={onStart}
                        onContinue={onContinue}
                      />
                    </div>
                    <Progress
                      value={course.progressPct / 100}
                      label={`Tiến độ khoá ${course.headline}`}
                      valueText={`${course.progressPct}% hoàn thành`}
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title="Xoá mục tiêu này?"
        confirmLabel="Xoá mục tiêu"
        cancelLabel="Giữ lại"
        initialFocus="cancel"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) onRemoveGoal?.(removing.id);
          setRemoving(null);
        }}
      >
        {removing
          ? `Tiến độ của “${removing.titleVi}” sẽ mất. Cụm từ đã lưu vào Kho cụm từ và lịch ôn vẫn giữ nguyên.`
          : ''}
      </ConfirmDialog>
    </div>
  );
}
