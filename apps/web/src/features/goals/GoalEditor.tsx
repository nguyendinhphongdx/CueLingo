'use client';

import { GOAL_CATALOG, GOAL_MAX, type Goal } from '@cuelingo/shared';
import { GoalPicker } from '@cuelingo/ui/components/goal-picker';
import { toCreateRequest, toUpdateRequest, useGoals } from './use-goals';

/**
 * Picks a new goal, or edits the level and deadline of one. Goals are English only for now, so the page
 * shows this only for English.
 */
export function GoalEditor({
  goals,
  editing,
  onDone,
}: {
  goals: Goal[];
  /** The goal being edited; leave out to add one. */
  editing?: Goal;
  onDone: () => void;
}) {
  const state = useGoals(false);
  const busy = state.creating || state.updating;
  return (
    <GoalPicker
      catalog={GOAL_CATALOG}
      taken={goals.map((goal) => goal.goalKey)}
      atLimit={goals.length >= GOAL_MAX}
      initial={
        editing
          ? { goalKey: editing.goalKey, level: editing.level, deadline: editing.deadline }
          : undefined
      }
      busy={busy}
      error={editing ? state.updateError : state.createError}
      onCancel={onDone}
      onSubmit={(value) => {
        if (editing) {
          const patch = toUpdateRequest(editing, value);
          if (!patch) return onDone();
          void state.update({ id: editing.id, patch }).then(onDone, () => undefined);
        } else {
          void state.create(toCreateRequest(value)).then(onDone, () => undefined);
        }
      }}
    />
  );
}
