export const cloudConsentKey = (userId: string) => `cuelingo.cloud-stt-consent.v2.${userId}`;
// v2: the text is language-neutral now; an agreement to the earlier Vietnamese-only text does not carry over.;

type ConsentStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Whom the consent belongs to; the panel sets it from the signed-in person, the controller only asks. */
let activeUser = 'dev';
export function setConsentUser(userId: string) {
  activeUser = userId;
}

/** Kept when storage is unavailable, so a person is asked once per run rather than at every start. */
const grantedInMemory = new Set<string>();

/** One confirmation covers every later cloud-language meeting of that person on this device (ADR 0014). */
export function hasCloudConsent(userId: string = activeUser, storage?: ConsentStorage) {
  if (grantedInMemory.has(userId)) return true;
  try {
    return (storage ?? globalThis.localStorage).getItem(cloudConsentKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export function grantCloudConsent(userId: string = activeUser, storage?: ConsentStorage) {
  grantedInMemory.add(userId);
  try {
    (storage ?? globalThis.localStorage).setItem(cloudConsentKey(userId), 'true');
  } catch {
    // The in-memory grant still covers this run.
  }
}
