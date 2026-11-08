import { CONNECTION_ERROR_MESSAGE } from '../../lib/errors';

/**
 * What the login screen shows for a failed attempt. Our own errors already carry a Vietnamese message; a `TypeError`
 * is how a browser reports that the request never reached the API ("Failed to fetch"), which must not be shown raw.
 */
export function loginErrorMessage(error: Error | null | undefined): string | null {
  if (!error) return null;
  return error instanceof TypeError ? CONNECTION_ERROR_MESSAGE : error.message;
}
