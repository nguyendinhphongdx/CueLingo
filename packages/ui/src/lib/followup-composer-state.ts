export type FollowupComposerChannel = 'email' | 'chat';
export type FollowupComposerTone = 'brief' | 'polite' | 'friendly';

/** A drafted message together with what it was drafted for. */
export interface FollowupDraftState {
  channel: FollowupComposerChannel;
  tone: FollowupComposerTone;
  subject: string | null;
  body: string;
  /** True once the person has changed the text, so a redraft must ask first. */
  edited: boolean;
}

export type FollowupStatus = 'idle' | 'loading' | 'error';
export type FollowupCopyState = 'idle' | 'copied' | 'fallback';

export interface FollowupComposerState {
  channel: FollowupComposerChannel;
  /** Null until the person picks a tone; then the default follows the channel. */
  chosenTone: FollowupComposerTone | null;
  draft: FollowupDraftState | null;
  status: FollowupStatus;
  errorMessage?: string;
  /** Id of the request in flight, or of the last one started. */
  requestId: number;
  copyState: FollowupCopyState;
  /** The full text shown selected when the clipboard is unavailable. */
  fallbackText: string | null;
}

export type FollowupComposerAction =
  | { type: 'channel'; channel: FollowupComposerChannel }
  | { type: 'tone'; tone: FollowupComposerTone }
  | { type: 'start'; requestId: number }
  | {
      type: 'success';
      requestId: number;
      channel: FollowupComposerChannel;
      tone: FollowupComposerTone;
      subject: string | null;
      body: string;
    }
  | { type: 'failure'; requestId: number; message?: string }
  | { type: 'subject'; subject: string }
  | { type: 'body'; body: string }
  | { type: 'copied' }
  | { type: 'copy-fallback'; text: string }
  | { type: 'copy-reset' };

/** Polite for email, brief for chat; used until the person picks a tone. */
export function defaultToneFor(channel: FollowupComposerChannel): FollowupComposerTone {
  return channel === 'email' ? 'polite' : 'brief';
}

export function currentTone(state: FollowupComposerState): FollowupComposerTone {
  return state.chosenTone ?? defaultToneFor(state.channel);
}

export function initialFollowupState(
  channel: FollowupComposerChannel = 'email',
  tone: FollowupComposerTone | null = null,
): FollowupComposerState {
  return {
    channel,
    chosenTone: tone,
    draft: null,
    status: 'idle',
    requestId: 0,
    copyState: 'idle',
    fallbackText: null,
  };
}

/** The selected channel or tone is not the one the shown draft was written for. */
export function draftMismatch(state: FollowupComposerState): boolean {
  const { draft } = state;
  return !!draft && (draft.channel !== state.channel || draft.tone !== currentTone(state));
}

/** What goes to the clipboard: for email the subject, a blank line, then the body. */
export function buildFollowupCopyText(draft: {
  channel: FollowupComposerChannel;
  subject: string | null;
  body: string;
}): string {
  const subject = draft.subject?.trim();
  return draft.channel === 'email' && subject ? `${subject}\n\n${draft.body}` : draft.body;
}

export function followupReducer(
  state: FollowupComposerState,
  action: FollowupComposerAction,
): FollowupComposerState {
  switch (action.type) {
    case 'channel':
      return { ...state, channel: action.channel };
    case 'tone':
      return { ...state, chosenTone: action.tone };
    case 'start':
      // A second start while one is in flight is ignored.
      if (state.status === 'loading') return state;
      return { ...state, status: 'loading', errorMessage: undefined, requestId: action.requestId };
    case 'success':
      // A response that is not for the latest request is stale.
      if (state.status !== 'loading' || action.requestId !== state.requestId) return state;
      return {
        ...state,
        status: 'idle',
        errorMessage: undefined,
        copyState: 'idle',
        fallbackText: null,
        draft: {
          channel: action.channel,
          tone: action.tone,
          subject: action.channel === 'email' ? (action.subject ?? '') : null,
          body: action.body,
          edited: false,
        },
      };
    case 'failure':
      if (state.status !== 'loading' || action.requestId !== state.requestId) return state;
      // The draft the person may have edited stays exactly as it is.
      return { ...state, status: 'error', errorMessage: action.message };
    case 'subject':
      return state.draft
        ? { ...state, draft: { ...state.draft, subject: action.subject, edited: true } }
        : state;
    case 'body':
      return state.draft
        ? { ...state, draft: { ...state.draft, body: action.body, edited: true } }
        : state;
    case 'copied':
      return { ...state, copyState: 'copied', fallbackText: null };
    case 'copy-fallback':
      return { ...state, copyState: 'fallback', fallbackText: action.text };
    case 'copy-reset':
      return state.copyState === 'copied' ? { ...state, copyState: 'idle' } : state;
  }
}
