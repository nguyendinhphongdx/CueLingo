import { cn } from '../lib/utils';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent } from './card';
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
  className?: string;
}

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

/**
 * The learning path: what to do next and the courses made from the user's meetings, with their
 * progress. Web and desktop both draw it. Presentation only: the caller fetches and acts.
 */
export function LearningPathPanel({
  data,
  loading = false,
  error = null,
  actionError = null,
  busySessionId = null,
  onStart,
  onContinue,
  className,
}: LearningPathPanelProps) {
  if (error) return <NoticeStrip tone="error">{error}</NoticeStrip>;
  if (!data || loading) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Đang tải lộ trình…
      </p>
    );
  }
  if (data.courses.length === 0) {
    return (
      <EmptyState
        title="Chưa có khoá nào"
        description="Khoá học được tạo từ debrief của cuộc họp, khi có ít nhất 3 cụm từ để học."
      />
    );
  }

  const nextCourse = data.nextUp
    ? data.courses.find((course) => course.sessionId === data.nextUp?.sessionId)
    : undefined;

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {actionError ? <NoticeStrip tone="error">{actionError}</NoticeStrip> : null}
      {data.nextUp && nextCourse ? (
        <section aria-labelledby="path-next-up" className="flex flex-col gap-2">
          <h2 id="path-next-up" className="text-heading">
            Việc nên làm tiếp
          </h2>
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
        </section>
      ) : null}

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
    </div>
  );
}
