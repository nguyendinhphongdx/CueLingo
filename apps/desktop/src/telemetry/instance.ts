import { assistApi } from '../quick-assist/assist-api';
import { createActivation } from './activation';

/** One per app: the session controller reports the first caption to it, the app reports sign-in. */
export const activation = createActivation({
  // Looked up at use, so a missing localStorage (tests, odd webviews) is caught instead of failing at import.
  store: {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  },
  record: (event) => assistApi.record(event),
});
