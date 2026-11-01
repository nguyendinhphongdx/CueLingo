import { create } from 'zustand';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  /** The device token from the Keychain; null until someone signs in. */
  token: string | null;
  set: (status: AuthStatus, token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  token: null,
  set: (status, token) => set({ status, token }),
}));

/** Token only set in the environment for local development against the dev API token. */
const devToken = (): string => import.meta.env.VITE_REALTIME_TOKEN || '';

/** The token every API call uses: the signed-in device token, else the development token, else none. */
export const currentToken = (): string => useAuthStore.getState().token ?? devToken();

export const isDevToken = (): boolean =>
  useAuthStore.getState().token === null && devToken() !== '';
