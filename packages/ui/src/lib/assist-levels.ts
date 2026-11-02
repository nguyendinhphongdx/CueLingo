/** How the assist level is named to people, from most help to least. One place, used by every client. */
export const ASSIST_LEVEL_LABELS = {
  4: 'Đầy đủ',
  3: 'Gợi ý',
  1: 'Tối thiểu',
  0: 'Ẩn',
} as const;

export type AssistLevelValue = keyof typeof ASSIST_LEVEL_LABELS;

export const assistLevelLabel = (level: number): string =>
  ASSIST_LEVEL_LABELS[level as AssistLevelValue] ?? String(level);
