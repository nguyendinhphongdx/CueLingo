import { serverConfig } from '../server';
import { native } from '../lib/native';

/** Opens a page of the web app in the default browser. */
export const openWeb = (path: string) => {
  const webUrl = serverConfig().webUrl;
  return native.openUrl(`${webUrl}${path}`);
};
