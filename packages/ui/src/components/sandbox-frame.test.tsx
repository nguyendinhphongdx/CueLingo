import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  RUNNER_PATH,
  SANDBOX_ALLOW,
  SANDBOX_FLAGS,
  SANDBOX_REFERRER_POLICY,
  runnerUrl,
} from '../lib/sandbox-attrs';
import {
  INITIAL_BLOCK_HEIGHT,
  initialSandboxState,
  sandboxReducer,
  stopReasonText,
  type SandboxState,
} from '../lib/sandbox-state';
import { SandboxFrame, SandboxFrameView } from './sandbox-frame';

const noop = () => {};
const SRC = 'http://localhost:3101/runner.html';
const view = (state: SandboxState, html = '<p>x</p>', title?: string) =>
  renderToStaticMarkup(
    <SandboxFrameView state={state} src={SRC} html={html} title={title} onToggleSource={noop} />,
  );

describe('sandbox attributes', () => {
  it('are scripts only: no same-origin, forms, popups, modals, navigation or downloads', () => {
    expect(SANDBOX_FLAGS).toBe('allow-scripts');
    expect(SANDBOX_FLAGS.split(' ')).toEqual(['allow-scripts']);
    expect(SANDBOX_ALLOW).toBe('');
    expect(SANDBOX_REFERRER_POLICY).toBe('no-referrer');
  });

  it('builds the runner URL from a plain http(s) origin only', () => {
    expect(runnerUrl('http://localhost:3101')).toBe(`http://localhost:3101${RUNNER_PATH}`);
    expect(runnerUrl('https://sandbox.example.com/')).toBe(
      'https://sandbox.example.com/runner.html',
    );
    expect(runnerUrl('https://sandbox.example.com/some/path?x=1')).toBe(
      'https://sandbox.example.com/runner.html',
    );
    for (const bad of [
      '',
      '   ',
      null,
      undefined,
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///etc',
      'not a url',
    ])
      expect(runnerUrl(bad)).toBeNull();
  });
});

describe('SandboxFrameView', () => {
  it('draws one iframe with sandbox="allow-scripts" and nothing that widens it', () => {
    const out = view(initialSandboxState());
    expect(out.match(/<iframe/g)).toHaveLength(1);
    expect(out).toContain('sandbox="allow-scripts"');
    expect(out).toContain('allow=""');
    expect(out).toContain('referrerPolicy="no-referrer"');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain(`src="${SRC}"`);
    for (const widening of [
      'allow-same-origin',
      'allow-top-navigation',
      'allow-popups',
      'allow-forms',
      'allow-modals',
      'allow-downloads',
      'allow-pointer-lock',
      'srcDoc',
      'srcdoc',
    ])
      expect(out).not.toContain(widening);
  });

  it('never puts the page into the markup of the app, only into the frame it sends later', () => {
    const out = view(initialSandboxState(), '<script>parent.document.cookie</script>');
    expect(out).not.toContain('parent.document');
    expect(out).not.toContain('<script');
  });

  it('applies the height the page asked for', () => {
    const out = view({ ...initialSandboxState(), height: 321 });
    expect(out).toContain('height:321px');
    expect(INITIAL_BLOCK_HEIGHT).toBe(160);
  });

  it('removes the iframe and offers the source once the block is stopped (AC8)', () => {
    const stopped = sandboxReducer(initialSandboxState(), { type: 'stopped', reason: 'no_pong' });
    const out = view(stopped);
    expect(out).not.toContain('<iframe');
    expect(out).toContain('Khối giao diện đã bị dừng');
    expect(out).toContain('Khối ngừng phản hồi.');
    expect(out).toContain('Xem mã nguồn');
    expect(out).toContain('role="status"');
  });

  it('shows the source as escaped text, so reading it cannot run it', () => {
    const html = '<img src=x onerror="alert(1)"><script>evil()</script>';
    const state = sandboxReducer(
      sandboxReducer(initialSandboxState(), { type: 'stopped', reason: 'error' }),
      { type: 'toggleSource' },
    );
    const out = view(state, html);
    expect(out).toContain('Ẩn mã nguồn');
    expect(out).toContain(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;script&gt;evil()&lt;/script&gt;',
    );
    expect(out).not.toContain('<script');
    expect(out).not.toMatch(/<img[^>]*onerror/);
  });

  it('escapes a hostile title', () => {
    const out = view(initialSandboxState(), '<p/>', '<b onmouseover=x>t</b>');
    expect(out).not.toContain('<b onmouseover');
    expect(out).toContain('&lt;b onmouseover=x&gt;t&lt;/b&gt;');
  });
});

describe('SandboxFrame', () => {
  const props = {
    html: '<p>x</p>',
    onListPhrases: async () => [],
    onSavePhrase: async () => {},
    onSpeak: () => {},
  };

  it('renders the sandboxed iframe for a valid runner origin', () => {
    const out = renderToStaticMarkup(
      <SandboxFrame {...props} runnerOrigin="http://localhost:3101" />,
    );
    expect(out).toContain(`src="${SRC}"`);
    expect(out).toContain('sandbox="allow-scripts"');
    // The save dialog is host UI and stays closed until a block asks.
    expect(out).not.toContain('alertdialog');
  });

  it('draws no iframe at all when the runner origin is not usable', () => {
    for (const origin of ['', 'javascript:alert(1)', 'nonsense']) {
      const out = renderToStaticMarkup(<SandboxFrame {...props} runnerOrigin={origin} />);
      expect(out).not.toContain('<iframe');
      expect(out).toContain('Khối giao diện đã bị dừng');
      expect(out).toContain(stopReasonText('unavailable'));
    }
  });
});

describe('sandboxReducer', () => {
  it('goes loading → running, follows resize, and a stopped block stays stopped', () => {
    let state = initialSandboxState();
    expect(state.phase).toBe('loading');
    state = sandboxReducer(state, { type: 'ready' });
    expect(state.phase).toBe('running');
    state = sandboxReducer(state, { type: 'resize', height: 400 });
    expect(state.height).toBe(400);
    state = sandboxReducer(state, { type: 'stopped', reason: 'error' });
    expect(state).toMatchObject({ phase: 'stopped', reason: 'error', height: 400 });
    // Late messages from the removed frame change nothing.
    expect(sandboxReducer(state, { type: 'ready' })).toBe(state);
    expect(sandboxReducer(state, { type: 'resize', height: 900 })).toBe(state);
    expect(sandboxReducer(state, { type: 'stopped', reason: 'no_pong' })).toBe(state);
  });

  it('toggles the source before and after a stop', () => {
    let state = sandboxReducer(initialSandboxState(), { type: 'toggleSource' });
    expect(state.showSource).toBe(true);
    state = sandboxReducer(state, { type: 'stopped', reason: 'no_ready' });
    expect(state.showSource).toBe(true);
    expect(sandboxReducer(state, { type: 'toggleSource' }).showSource).toBe(false);
  });

  it('has a sentence for every reason', () => {
    for (const reason of ['no_ready', 'no_pong', 'error', 'unavailable'] as const)
      expect(stopReasonText(reason).length).toBeGreaterThan(5);
    expect(stopReasonText(undefined)).toBe('');
  });
});
