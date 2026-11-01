import { native } from '../lib/native';

/** Opens a page of the web app in the default browser. */
export const openWeb = (path: string) => {
  const webUrl = (import.meta.env.VITE_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
  return native.openUrl(`${webUrl}${path}`);
};
