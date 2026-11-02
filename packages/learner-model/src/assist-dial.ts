/**
 * The Assist Dial: how much help the captions give. This module only decides whether to *suggest* a
 * change from how recent meetings went. It never changes anything by itself.
 */

/** From most help to least: full captions, hints, translation only, hidden. */
export const ASSIST_LEVELS = [4, 3, 1, 0] as const;
export type AssistLevel = (typeof ASSIST_LEVELS)[number];

export interface MeetingOutcome {
  /** How much of the meeting the person understood, from the debrief; null when it could not be judged. */
  comprehensionPct: number | null;
  /** Words they looked up during the meeting. */
  lookups: number;
  startedAt: string;
}

export type AssistSuggestion =
  | { kind: 'keep'; currentLevel: AssistLevel }
  | {
      kind: 'lower' | 'raise';
      currentLevel: AssistLevel;
      suggestedLevel: AssistLevel;
      meetingsConsidered: number;
      avgComprehensionPct: number;
    };

export const RULES = {
  /** Meetings in a row that must all be good before help is lowered. */
  lowerAfter: 3,
  lowerAtOrAbovePct: 85,
  /** ...and the person must not be reaching for the dictionary a lot. */
  lowerMaxAvgLookups: 8,
  /** Meetings in a row that must all go badly before more help is offered. */
  raiseAfter: 2,
  raiseBelowPct: 55,
  /** After the person answers a suggestion (either way) wait this long before asking again. */
  cooldownDays: 7,
} as const;

const DAY_MS = 86_400_000;

const step = (level: AssistLevel, direction: 1 | -1): AssistLevel | null => {
  const index = ASSIST_LEVELS.indexOf(level) + direction;
  return ASSIST_LEVELS[index] ?? null;
};

/**
 * @param meetings recent meetings, newest first
 * @param lastDecisionAt when the person last applied or dismissed a suggestion
 */
export function suggestAssistLevel(
  current: AssistLevel,
  meetings: MeetingOutcome[],
  options: { lastDecisionAt?: string | null; now?: Date } = {},
): AssistSuggestion {
  const keep: AssistSuggestion = { kind: 'keep', currentLevel: current };
  const now = options.now ?? new Date();

  if (options.lastDecisionAt) {
    const waited = now.getTime() - new Date(options.lastDecisionAt).getTime();
    if (waited < RULES.cooldownDays * DAY_MS) return keep;
  }

  // Only meetings that happened after the last answer count, so a suggestion is never based on old evidence twice.
  const since = options.lastDecisionAt ? new Date(options.lastDecisionAt).getTime() : 0;
  const judged = meetings.filter(
    (meeting): meeting is MeetingOutcome & { comprehensionPct: number } =>
      meeting.comprehensionPct !== null && new Date(meeting.startedAt).getTime() > since,
  );

  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const lowerWindow = judged.slice(0, RULES.lowerAfter);
  const lower = step(current, 1);
  if (
    lower !== null &&
    lowerWindow.length === RULES.lowerAfter &&
    lowerWindow.every((meeting) => meeting.comprehensionPct >= RULES.lowerAtOrAbovePct) &&
    average(lowerWindow.map((meeting) => meeting.lookups)) <= RULES.lowerMaxAvgLookups
  ) {
    return {
      kind: 'lower',
      currentLevel: current,
      suggestedLevel: lower,
      meetingsConsidered: lowerWindow.length,
      avgComprehensionPct: Math.round(average(lowerWindow.map((m) => m.comprehensionPct))),
    };
  }

  const raiseWindow = judged.slice(0, RULES.raiseAfter);
  const raise = step(current, -1);
  if (
    raise !== null &&
    raiseWindow.length === RULES.raiseAfter &&
    raiseWindow.every((meeting) => meeting.comprehensionPct < RULES.raiseBelowPct)
  ) {
    return {
      kind: 'raise',
      currentLevel: current,
      suggestedLevel: raise,
      meetingsConsidered: raiseWindow.length,
      avgComprehensionPct: Math.round(average(raiseWindow.map((m) => m.comprehensionPct))),
    };
  }

  return keep;
}
