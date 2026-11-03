/**
 * Languages the listening placement test has content for. Mirrors `TESTS` in
 * services/api/src/modules/placement/placement.content.ts (a test keeps the two in step); add a code
 * here when the server gains content for it.
 */
export const PLACEMENT_LANGUAGES: readonly string[] = ['en'];

/**
 * Narrows language options to those with placement content and picks the language to test: the current
 * one when it has content, otherwise the first that does. With one option left the switcher hides itself.
 */
export function placementChoice<T extends string>(
  options: { value: T; label: string }[],
  current: T,
): { options: { value: T; label: string }[]; language: T } {
  const available = options.filter((option) => PLACEMENT_LANGUAGES.includes(option.value));
  const language = available.some((option) => option.value === current)
    ? current
    : (available[0]?.value ?? current);
  return { options: available, language };
}
