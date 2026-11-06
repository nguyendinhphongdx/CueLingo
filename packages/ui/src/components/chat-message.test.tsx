import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AgentCardLike } from '../lib/agent-card';
import { AgentCardView } from './agent-card-view';
import { ChatMessage, isAwaitingText } from './chat-message';
import { ThinkingIndicator } from './thinking-indicator';
import { toolStepLabel } from './tool-step';

describe('ChatMessage', () => {
  it('shows the user text as plain text, never as Markdown or HTML', () => {
    const out = renderToStaticMarkup(
      <ChatMessage role="user" parts={[{ type: 'text', text: '**hi** <b>x</b>' }]} />,
    );
    expect(out).toContain('**hi** &lt;b&gt;x&lt;/b&gt;');
    expect(out).not.toContain('<strong>');
  });

  it('renders assistant Markdown, tool steps in Vietnamese and cards', () => {
    const out = renderToStaticMarkup(
      <ChatMessage
        role="assistant"
        parts={[
          {
            type: 'tool_step',
            callId: 'c1',
            tool: 'save_phrase',
            status: 'ok',
            summary: 'Đã lưu "x"',
          },
          { type: 'text', text: 'Xong **rồi**' },
          {
            type: 'card',
            card: { kind: 'phrase_list', data: { items: [{ phrase: 'touch base' }] } },
          },
        ]}
      />,
    );
    expect(out).toContain('Đã lưu cụm từ');
    expect(out).toContain('<strong>rồi</strong>');
    expect(out).toContain('touch base');
    expect(out).toContain('data-chat-text');
    expect(out).not.toContain('role="status"');
  });

  it('shows thinking while the reply has no text yet, and a note when it ended early', () => {
    const waiting = renderToStaticMarkup(
      <ChatMessage role="assistant" parts={[]} status="streaming" />,
    );
    expect(waiting).toContain('Đang suy nghĩ');
    expect(waiting).toContain('aria-busy="true"');
    expect(
      renderToStaticMarkup(
        <ChatMessage role="assistant" parts={[{ type: 'text', text: 'a' }]} status="stopped" />,
      ),
    ).toContain('Đã dừng trả lời');
    expect(
      renderToStaticMarkup(<ChatMessage role="assistant" parts={[]} status="error" />),
    ).toContain('role="alert"');
  });

  it('isAwaitingText is true only while streaming and not mid-text', () => {
    expect(isAwaitingText('streaming', [])).toBe(true);
    expect(isAwaitingText('streaming', [{ type: 'text', text: 'a' }])).toBe(false);
    expect(
      isAwaitingText('streaming', [
        { type: 'tool_step', callId: '1', tool: 't', status: 'running' },
      ]),
    ).toBe(true);
    expect(isAwaitingText('complete', [])).toBe(false);
  });
});

describe('toolStepLabel', () => {
  it('has Vietnamese labels per tool and state, and a generic one for unknown tools', () => {
    expect(toolStepLabel('lookup_word', 'running')).toBe('Đang tra từ…');
    expect(toolStepLabel('list_saved_phrases', 'ok')).toBe('Đã xem cụm từ đã lưu');
    expect(toolStepLabel('show_card', 'error')).toBe('Chưa tạo được thẻ');
    expect(toolStepLabel('secret_plugin_tool', 'ok')).toBe('Đã dùng công cụ');
    expect(toolStepLabel('render_html', 'ok')).toBe('Đã tạo khối giao diện');
  });
});

describe('ChatMessage html_block', () => {
  const parts = [
    { type: 'card' as const, card: { kind: 'html_block' as const, data: { html: '<b>page</b>' } } },
  ];

  it('shows a placeholder, never the page, when the client gives no renderer', () => {
    const out = renderToStaticMarkup(<ChatMessage role="assistant" parts={parts} />);
    expect(out).toContain('chưa được bật');
    expect(out).not.toContain('<b>page</b>');
  });

  it('lets the client draw the block', () => {
    const out = renderToStaticMarkup(
      <ChatMessage
        role="assistant"
        parts={parts}
        renderHtmlBlock={(data) => <section>{data.html.length}</section>}
      />,
    );
    expect(out).toContain('<section>11</section>');
  });
});

describe('AgentCardView html_block without a renderer', () => {
  const card: AgentCardLike = {
    kind: 'html_block',
    data: { html: '<script>alert(1)</script><b>x</b>' },
  };

  it('never puts the page in the markup; it says the feature is off', () => {
    const out = renderToStaticMarkup(<AgentCardView card={card} />);
    expect(out).toContain('chưa được bật');
    expect(out).not.toContain('alert(1)');
    expect(out).not.toContain('<iframe');
  });

  it('hands the data to the client renderer when there is one', () => {
    const out = renderToStaticMarkup(
      <AgentCardView card={card} renderHtmlBlock={(data) => <i>{data.html.length}</i>} />,
    );
    expect(out).toContain('<i>33</i>');
  });
});

describe('ThinkingIndicator', () => {
  it('announces itself and only animates when motion is allowed', () => {
    const out = renderToStaticMarkup(<ThinkingIndicator />);
    expect(out).toContain('role="status"');
    expect(out).toContain('motion-safe:animate-bounce');
    expect(out).not.toMatch(/[^:-]animate-bounce/);
  });
});

describe('AgentCardView', () => {
  const view = (card: Parameters<typeof AgentCardView>[0]['card']) =>
    renderToStaticMarkup(<AgentCardView card={card} />);

  it('draws flashcards with the shared deck', () => {
    const out = view({
      kind: 'flashcards',
      data: { title: 'Bộ thẻ', cards: [{ front: 'touch base', back: 'giữ liên lạc' }] },
    });
    expect(out).toContain('Bộ thẻ');
    expect(out).toContain('data-testid="flashcard"');
    expect(out).toContain('giữ liên lạc');
  });

  it('draws a cloze with an input per item and a check button', () => {
    const out = view({
      kind: 'cloze',
      data: { items: [{ sentence: "Let's ___ next week.", answer: 'sync', hint: 'đồng bộ' }] },
    });
    expect(out).toContain('aria-label="Điền vào chỗ trống"');
    expect(out).toContain('Kiểm tra');
    expect(out).toContain('Gợi ý: đồng bộ');
    expect(out).not.toContain('Đáp án');
  });

  it('draws quiz options as buttons without revealing the answer', () => {
    const out = view({
      kind: 'quiz_choice',
      data: { question: 'Chọn nghĩa', options: ['a', 'b'], answerIndex: 1, explanation: 'vì b' },
    });
    expect(out.match(/<button/g)).toHaveLength(2);
    expect(out).not.toContain('vì b');
    expect(out).not.toContain('Đáp án đúng');
  });

  it('draws a comparison table and escapes cell text', () => {
    const out = view({
      kind: 'compare_table',
      data: { columns: ['A', 'B'], rows: [['<script>x</script>', 'y']] },
    });
    expect(out).toContain('<th');
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>');
  });

  it('draws a phrase list with a speaker only when audio can be loaded', () => {
    const card: AgentCardLike = {
      kind: 'phrase_list',
      data: { items: [{ phrase: 'circle back', meaningVi: 'quay lại', example: 'Let us.' }] },
    };
    expect(view(card)).not.toContain('Nghe phát âm');
    expect(
      renderToStaticMarkup(<AgentCardView card={card} loadAudio={async () => new Blob()} />),
    ).toContain('Nghe phát âm');
  });
});
