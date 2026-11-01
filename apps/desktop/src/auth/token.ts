/** A token, or a function that returns the current one so clients pick up a sign-in without being rebuilt. */
export type TokenSource = string | (() => string);

export const resolveToken = (source: TokenSource): string =>
  typeof source === 'function' ? source() : source;
