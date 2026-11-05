/** What the web client tells the server about itself with a piece of feedback: no more than this. */
export function webClientInfo(nav: Pick<Navigator, 'platform'> = navigator): {
  appVersion: string;
  os: string;
} {
  return { appVersion: 'web', os: (nav.platform || 'unknown').slice(0, 80) };
}
