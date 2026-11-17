import type { SessionStatus } from './session-controller';

/** A meeting is on (connecting, running or reconnecting): a second start would be ignored. */
export const isMeetingLive = (status: SessionStatus) => status !== 'idle' && status !== 'error';
