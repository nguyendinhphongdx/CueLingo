import { describe, expect, it } from 'vitest';
import {
  buildFollowupCopyText,
  currentTone,
  defaultToneFor,
  draftMismatch,
  followupReducer as reduce,
  initialFollowupState,
  type FollowupComposerAction,
  type FollowupComposerState,
} from './followup-composer-state';

const run = (state: FollowupComposerState, ...actions: FollowupComposerAction[]) =>
  actions.reduce(reduce, state);
const success = (requestId: number, channel: 'email' | 'chat' = 'email') =>
  ({
    type: 'success',
    requestId,
    channel,
    tone: channel === 'email' ? 'polite' : 'brief',
    subject: channel === 'email' ? 'Tiêu đề' : null,
    body: 'Nội dung',
  }) as const;

describe('followup composer state', () => {
  it('starts into loading and then holds a draft with its channel and tone', () => {
    const loading = run(initialFollowupState(), { type: 'start', requestId: 1 });
    expect(loading.status).toBe('loading');
    const done = reduce(loading, success(1));
    expect(done.status).toBe('idle');
    expect(done.draft).toEqual({
      channel: 'email',
      tone: 'polite',
      subject: 'Tiêu đề',
      body: 'Nội dung',
      edited: false,
    });
  });

  it('ignores a second start while loading', () => {
    const loading = run(initialFollowupState(), { type: 'start', requestId: 1 });
    expect(reduce(loading, { type: 'start', requestId: 2 })).toBe(loading);
  });

  it('ignores a stale response', () => {
    const state = run(initialFollowupState(), { type: 'start', requestId: 1 }, success(1), {
      type: 'start',
      requestId: 2,
    });
    const stale = reduce(state, { ...success(1, 'chat'), body: 'cũ' });
    expect(stale).toBe(state);
    expect(reduce(state, { type: 'failure', requestId: 1, message: 'x' })).toBe(state);
  });

  it('keeps the edits and shows the error when a redraft fails', () => {
    const state = run(
      initialFollowupState(),
      { type: 'start', requestId: 1 },
      success(1),
      { type: 'body', body: 'Bản đã sửa' },
      { type: 'subject', subject: 'Tiêu đề sửa' },
      { type: 'start', requestId: 2 },
      { type: 'failure', requestId: 2, message: 'Lỗi' },
    );
    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('Lỗi');
    expect(state.draft).toMatchObject({ body: 'Bản đã sửa', subject: 'Tiêu đề sửa', edited: true });
  });

  it('can start again after a failure', () => {
    const state = run(
      initialFollowupState(),
      { type: 'start', requestId: 1 },
      { type: 'failure', requestId: 1 },
      { type: 'start', requestId: 2 },
    );
    expect(state.status).toBe('loading');
    expect(state.errorMessage).toBeUndefined();
  });

  it('keeps the draft on a channel change and flags the mismatch', () => {
    const drafted = run(initialFollowupState(), { type: 'start', requestId: 1 }, success(1));
    expect(draftMismatch(drafted)).toBe(false);
    const switched = reduce(drafted, { type: 'channel', channel: 'chat' });
    expect(switched.draft).toBe(drafted.draft);
    expect(draftMismatch(switched)).toBe(true);
    expect(draftMismatch(reduce(switched, { type: 'channel', channel: 'email' }))).toBe(false);
  });

  it('flags a different tone as a mismatch too', () => {
    const drafted = run(initialFollowupState(), { type: 'start', requestId: 1 }, success(1));
    expect(draftMismatch(reduce(drafted, { type: 'tone', tone: 'friendly' }))).toBe(true);
  });

  it('changes the default tone with the channel only until a tone is chosen', () => {
    const state = initialFollowupState();
    expect(currentTone(reduce(state, { type: 'channel', channel: 'chat' }))).toBe('brief');
    const chosen = run(
      state,
      { type: 'tone', tone: 'friendly' },
      { type: 'channel', channel: 'chat' },
    );
    expect(currentTone(chosen)).toBe('friendly');
    expect(defaultToneFor('email')).toBe('polite');
  });

  it('marks the draft edited only when the person types', () => {
    const drafted = run(initialFollowupState(), { type: 'start', requestId: 1 }, success(1));
    expect(drafted.draft?.edited).toBe(false);
    expect(reduce(drafted, { type: 'body', body: 'x' }).draft?.edited).toBe(true);
    expect(reduce(initialFollowupState(), { type: 'body', body: 'x' }).draft).toBeNull();
  });

  it('copies using the draft channel, not the selected one', () => {
    const drafted = run(initialFollowupState(), { type: 'start', requestId: 1 }, success(1), {
      type: 'channel',
      channel: 'chat',
    });
    expect(buildFollowupCopyText(drafted.draft!)).toBe('Tiêu đề\n\nNội dung');
    const chat = run(
      initialFollowupState('chat'),
      { type: 'start', requestId: 1 },
      success(1, 'chat'),
      { type: 'channel', channel: 'email' },
    );
    expect(buildFollowupCopyText(chat.draft!)).toBe('Nội dung');
    expect(chat.draft?.subject).toBeNull();
  });

  it('gives an email draft an empty subject when the model returned none', () => {
    const state = run(
      initialFollowupState(),
      { type: 'start', requestId: 1 },
      {
        ...success(1),
        subject: null,
      },
    );
    expect(state.draft?.subject).toBe('');
  });

  it('tracks the copy confirmation and the fallback text', () => {
    const copied = reduce(initialFollowupState(), { type: 'copied' });
    expect(copied.copyState).toBe('copied');
    expect(reduce(copied, { type: 'copy-reset' }).copyState).toBe('idle');
    const fallback = reduce(copied, { type: 'copy-fallback', text: 'full' });
    expect(fallback).toMatchObject({ copyState: 'fallback', fallbackText: 'full' });
    expect(reduce(fallback, { type: 'copy-reset' })).toBe(fallback);
  });
});
