/** The code of an error from the native side: a string, an Error whose message is the code, or `{ code }`. */
export function nativeErrorCode(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'code' in error) return String(error.code);
  return '';
}
