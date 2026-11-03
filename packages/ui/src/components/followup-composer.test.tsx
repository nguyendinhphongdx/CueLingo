import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  followupReducer,
  initialFollowupState,
  type FollowupComposerAction,
  type FollowupComposerState,
} from '../lib/followup-composer-state';
import {
  FOLLOWUP_COPY_FALLBACK_TEXT,
  FOLLOWUP_ERROR_TEXT,
  FOLLOWUP_MISMATCH_TEXT,
  FOLLOWUP_REDRAFT_CONFIRM_TEXT,
  FollowupComposer,
  FollowupComposerView,
  type FollowupComposerViewProps,
} from './followup-composer';

const noop = () => {};
const run = (...actions: FollowupComposerAction[]): FollowupComposerState =>
  actions.reduce(followupReducer, initialFollowupState());
const drafted = (channel: 'email' | 'chat' = 'email', body = 'Chào cả nhóm') =>
  run(
    { type: 'channel', channel },
    { type: 'start', requestId: 1 },
    {
      type: 'success',
      requestId: 1,
      channel,
      tone: channel === 'email' ? 'polite' : 'brief',
      subject: channel === 'email' ? 'Tóm tắt họp' : null,
      body,
    },
  );

const view = (state: FollowupComposerState, props: Partial<FollowupComposerViewProps> = {}) =>
  renderToStaticMarkup(
    <FollowupComposerView
      state={state}
      onChannel={noop}
      onTone={noop}
      onSubject={noop}
      onBody={noop}
      onCompose={noop}
      onConfirmRedraft={noop}
      onCancelRedraft={noop}
      onCopy={noop}
      {...props}
    />,
  );

describe('FollowupComposerView', () => {
  it('shows the channel and tone choices and a compose button, with no result yet', () => {
    const markup = view(initialFollowupState());
    for (const text of ['Email', 'Tin nhắn nhóm', 'Ngắn gọn', 'Lịch sự', 'Thân mật', '>Soạn<']) {
      expect(markup).toContain(text);
    }
    expect(markup).not.toContain('Sao chép');
    expect(markup).not.toContain('Kiểm tra lại trước khi gửi.');
  });

  it('announces its result area politely', () => {
    expect(view(initialFollowupState())).toContain('aria-live="polite"');
  });

  it('shows a calm loading state that disables the button', () => {
    const markup = view(run({ type: 'start', requestId: 1 }));
    expect(markup).toContain('Đang soạn…');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('motion-reduce:animate-none');
  });

  it('shows an editable subject, body, copy button and a review note for email', () => {
    const markup = view(drafted());
    expect(markup).toContain('aria-label="Tiêu đề"');
    expect(markup).toContain('value="Tóm tắt họp"');
    expect(markup).toContain('Chào cả nhóm');
    expect(markup).toContain('Sao chép');
    expect(markup).toContain('Soạn lại');
    expect(markup).toContain('Kiểm tra lại trước khi gửi.');
    expect(markup).not.toContain(FOLLOWUP_MISMATCH_TEXT);
  });

  it('has no subject field for a chat draft', () => {
    const markup = view(drafted('chat'));
    expect(markup).not.toContain('aria-label="Tiêu đề"');
  });

  it('keeps the draft shape and shows the hint after switching channel', () => {
    const state = followupReducer(drafted('email'), { type: 'channel', channel: 'chat' });
    const markup = view(state);
    expect(markup).toContain('aria-label="Tiêu đề"');
    expect(markup).toContain(FOLLOWUP_MISMATCH_TEXT);
  });

  it('confirms a copy', () => {
    expect(view(followupReducer(drafted(), { type: 'copied' }))).toContain('Đã sao chép');
  });

  it('shows the full text selected in a read-only box when the clipboard is unavailable', () => {
    const state = followupReducer(drafted(), {
      type: 'copy-fallback',
      text: 'Tóm tắt họp\n\nChào cả nhóm',
    });
    const markup = view(state);
    expect(markup).toContain(FOLLOWUP_COPY_FALLBACK_TEXT);
    expect(markup).toContain('readOnly');
    expect(markup).toContain('Tóm tắt họp\n\nChào cả nhóm');
  });

  it('shows the error with a retry button and keeps the edited draft', () => {
    const state = run(
      { type: 'start', requestId: 1 },
      { type: 'success', requestId: 1, channel: 'email', tone: 'polite', subject: 's', body: 'b' },
      { type: 'body', body: 'Bản đã sửa' },
      { type: 'start', requestId: 2 },
      { type: 'failure', requestId: 2, message: 'Máy chủ bận' },
    );
    const markup = view(state);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Máy chủ bận');
    expect(markup).toContain('Thử lại');
    expect(markup).toContain('Bản đã sửa');
  });

  it('falls back to a generic message when none is given', () => {
    const state = run({ type: 'start', requestId: 1 }, { type: 'failure', requestId: 1 });
    expect(view(state)).toContain(FOLLOWUP_ERROR_TEXT);
  });

  it('asks before replacing an edited draft', () => {
    const markup = view(drafted(), { confirmingRedraft: true });
    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain(FOLLOWUP_REDRAFT_CONFIRM_TEXT);
    expect(view(drafted())).not.toContain('role="alertdialog"');
  });
});

describe('FollowupComposer', () => {
  it('starts with the email defaults, polite tone selected', () => {
    const markup = renderToStaticMarkup(<FollowupComposer onCompose={vi.fn()} />);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Email</);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Lịch sự</);
  });

  it('starts on chat with brief when asked', () => {
    const markup = renderToStaticMarkup(
      <FollowupComposer onCompose={vi.fn()} defaultChannel="chat" />,
    );
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Tin nhắn nhóm</);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Ngắn gọn</);
  });

  it('keeps an explicit default tone', () => {
    const markup = renderToStaticMarkup(
      <FollowupComposer onCompose={vi.fn()} defaultTone="friendly" />,
    );
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Thân mật</);
  });
});
