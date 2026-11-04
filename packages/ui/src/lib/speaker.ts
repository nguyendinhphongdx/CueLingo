export type SpeakerSource = 'mic' | 'system';

export interface SpeakerLike {
  /** `me`, `speaker_1`..`speaker_8`, or none (older sentences, overflow speakers). */
  label?: string | null;
  /** The name the user gave this speaker. */
  displayName?: string | null;
  source: SpeakerSource;
}

const OTHER = 'Người khác';
const ME = 'Tôi';

/** N of `speaker_N`, or null for any other label. */
export function speakerNumber(label: string | null | undefined): number | null {
  const match = /^speaker_([1-8])$/.exec(label ?? '');
  return match ? Number(match[1]) : null;
}

/** What the product calls a speaker: "Tôi", the name the user set, "Speaker N" or "Người khác". */
export function speakerDisplayName({ label, displayName, source }: SpeakerLike): string {
  const isMe = label === 'me' || (!label && source === 'mic');
  if (isMe) return ME;
  const name = displayName?.trim();
  if (name) return name;
  const number = speakerNumber(label);
  return number === null ? OTHER : `Speaker ${number}`;
}
