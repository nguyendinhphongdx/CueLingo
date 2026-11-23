import { useId, useState } from 'react';
import { describeGoalLevel, GOAL_LEVEL_OPTIONS, LESSON_AI_NOTE } from '../lib/goal-lesson';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Input } from './input';
import { NoticeStrip } from './notice-strip';

/** Structurally the same as the catalog entries of `@cuelingo/shared` (ui does not depend on it). */
export interface PickerGoal {
  key: string;
  titleVi: string;
  summaryVi: string;
  fits: readonly [string, string];
}

export interface GoalPickerValue {
  goalKey: string;
  /** Null: the person left it on "automatic", so the server uses their listening level (else B1). */
  level: string | null;
  /** `YYYY-MM-DD` or null. */
  deadline: string | null;
}

export interface GoalPickerProps {
  catalog: ReadonlyArray<PickerGoal>;
  /** Keys of the goals the person already has. */
  taken?: ReadonlyArray<string>;
  /** The person already has the most goals allowed. */
  atLimit?: boolean;
  /** `edit` changes the level and the deadline of one goal; the goal itself is fixed. */
  initial?: GoalPickerValue;
  busy?: boolean;
  /** Vietnamese message when saving failed. */
  error?: string | null;
  onSubmit: (value: GoalPickerValue) => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * Picks one goal from the fixed list, a level and an optional deadline (AC1). The same form edits a
 * goal. Presentation only: the caller saves and shows the error.
 */
export function GoalPicker({
  catalog,
  taken = [],
  atLimit = false,
  initial,
  busy = false,
  error = null,
  onSubmit,
  onCancel,
  className,
}: GoalPickerProps) {
  const id = useId();
  const editing = initial !== undefined;
  const [goalKey, setGoalKey] = useState(initial?.goalKey ?? '');
  // '' is "automatic": only offered when creating, where the server can pick the level.
  const [level, setLevel] = useState(initial?.level ?? '');
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');

  const fixed = editing ? catalog.find((goal) => goal.key === initial.goalKey) : undefined;
  const blocked = !editing && atLimit;
  const canSubmit = !busy && !blocked && goalKey !== '';

  return (
    <form
      className={cn('flex flex-col gap-5', className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit({ goalKey, level: level || null, deadline: deadline || null });
      }}
    >
      {blocked ? (
        <NoticeStrip tone="warning">
          Bạn đã có 3 mục tiêu. Xoá bớt một mục tiêu để thêm mục tiêu mới.
        </NoticeStrip>
      ) : null}
      {error ? <NoticeStrip tone="error">{error}</NoticeStrip> : null}

      {editing ? (
        <div>
          <p className="text-muted-foreground text-caption">Mục tiêu</p>
          <p className="font-medium">{fixed?.titleVi ?? initial.goalKey}</p>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-2" disabled={blocked || busy}>
          <legend className="text-heading mb-1">Bạn muốn làm được gì?</legend>
          {catalog.map((goal) => {
            const already = taken.includes(goal.key);
            const checked = goalKey === goal.key;
            return (
              <label
                key={goal.key}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                  checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                  already && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-goal`}
                  value={goal.key}
                  checked={checked}
                  disabled={already}
                  onChange={() => setGoalKey(goal.key)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block font-medium">{goal.titleVi}</span>
                  <span className="text-muted-foreground text-body-sm block">{goal.summaryVi}</span>
                  <span className="text-muted-foreground text-caption block">
                    {already
                      ? 'Bạn đã chọn mục tiêu này'
                      : `Hợp với ${describeGoalLevel(goal.fits[0])} đến ${describeGoalLevel(goal.fits[1])}`}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-level`} className="text-sm font-medium">
            Trình độ
          </label>
          <select
            id={`${id}-level`}
            value={level}
            disabled={busy}
            onChange={(event) => setLevel(event.target.value)}
            className="border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            {editing ? null : <option value="">Theo trình độ nghe của bạn (mặc định B1)</option>}
            {GOAL_LEVEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {describeGoalLevel(option)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-deadline`} className="text-sm font-medium">
            Hạn chót (không bắt buộc)
          </label>
          <Input
            id={`${id}-deadline`}
            type="date"
            value={deadline}
            disabled={busy}
            onChange={(event) => setDeadline(event.target.value)}
            className="w-44"
          />
        </div>
      </div>

      <p className="text-muted-foreground text-body-sm">{LESSON_AI_NOTE}</p>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!canSubmit}>
          {editing ? 'Lưu thay đổi' : 'Đặt mục tiêu'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Huỷ
          </Button>
        ) : null}
      </div>
    </form>
  );
}
