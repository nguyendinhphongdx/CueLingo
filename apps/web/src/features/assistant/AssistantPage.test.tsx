import type { Conversation } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChatView } from './ChatView';
import { ConversationList } from './ConversationList';
import type { DisplayMessage } from './chat-state';
import { STARTER_PROMPTS } from './starter-prompts';

const noop = () => {};
const view = (messages: DisplayMessage[], over: Partial<Parameters<typeof ChatView>[0]> = {}) =>
  renderToStaticMarkup(
    <ChatView
      messages={messages}
      sending={false}
      error={null}
      loading={false}
      loadError={null}
      onSend={async () => true}
      onStop={noop}
      onDismissError={noop}
      loadAudio={async () => new Blob()}
      onWordDoubleClick={noop}
      {...over}
    />,
  );

describe('ChatView', () => {
  it('shows starter prompts when the chat is empty', () => {
    const out = view([]);
    expect(out).toContain('Gợi ý câu hỏi');
    for (const prompt of STARTER_PROMPTS) expect(out.replace(/&quot;/g, '"')).toContain(prompt);
    expect(out).toContain('aria-label="Tin nhắn cho trợ lý"');
    expect(out).toContain('Gửi');
  });

  it('shows the conversation, the double-click hint and no starters once there are messages', () => {
    const out = view([
      {
        key: 'seq-0',
        role: 'user',
        parts: [{ type: 'text', text: 'Xin chào' }],
        status: 'complete',
      },
      {
        key: 'seq-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Chào bạn' }],
        status: 'complete',
      },
    ]);
    expect(out).toContain('Xin chào');
    expect(out).toContain('Chào bạn');
    expect(out).toContain('Nhấp đúp vào một từ');
    expect(out).not.toContain('Gợi ý câu hỏi');
  });

  it('turns Gửi into a Dừng button while a turn is running', () => {
    const out = view([{ key: 'seq-1', role: 'assistant', parts: [], status: 'streaming' }], {
      sending: true,
    });
    expect(out).toContain('Dừng');
    expect(out).not.toContain('>Gửi<');
    expect(out).toContain('Đang suy nghĩ');
  });

  describe('html blocks (AC7: behind a flag)', () => {
    const block: DisplayMessage = {
      key: 'seq-1',
      role: 'assistant',
      parts: [
        { type: 'card', card: { kind: 'html_block', data: { html: '<script>steal()</script>' } } },
      ],
      status: 'complete',
    };

    it('draws no frame and none of the page while the feature is off', () => {
      const out = view([block]);
      expect(out).toContain('chưa được bật');
      expect(out).not.toContain('<iframe');
      expect(out).not.toContain('steal()');
    });

    it('hands the block to the renderer when the feature is on', () => {
      const out = view([block], {
        renderHtmlBlock: (data) => <div data-testid="block">{data.html.length}</div>,
      });
      expect(out).toContain('data-testid="block"');
      expect(out).not.toContain('chưa được bật');
    });
  });

  it('shows a dismissable error', () => {
    const out = view([], { error: 'Trợ lý AI đang tạm tắt. Hãy quay lại sau.' });
    expect(out).toContain('role="alert"');
    expect(out).toContain('Trợ lý AI đang tạm tắt');
    expect(out).toContain('Đóng');
  });
});

describe('ConversationList', () => {
  const conversation = (id: string, title: string): Conversation => ({
    id,
    title,
    language: 'en',
    createdAt: '2026-11-05T00:00:00.000Z',
    updatedAt: '2026-11-05T00:00:00.000Z',
  });

  it('links each conversation and offers rename and delete with accessible names', () => {
    const id = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
    const out = renderToStaticMarkup(
      <ConversationList
        items={[conversation(id, 'Chuẩn bị họp')]}
        renaming={false}
        onRename={async () => undefined}
        onDelete={noop}
      />,
    );
    expect(out).toContain(`href="/assistant/${id}"`);
    expect(out).toContain('Chuẩn bị họp');
    expect(out).toContain('aria-label="Đổi tên Chuẩn bị họp"');
    expect(out).toContain('aria-label="Xoá Chuẩn bị họp"');
  });

  it('names an untitled chat and has an empty state', () => {
    const id = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
    const props = { renaming: false, onRename: async () => undefined, onDelete: noop };
    expect(
      renderToStaticMarkup(<ConversationList items={[conversation(id, '')]} {...props} />),
    ).toContain('Cuộc trò chuyện mới');
    expect(renderToStaticMarkup(<ConversationList items={[]} {...props} />)).toContain(
      'Chưa có cuộc trò chuyện nào',
    );
  });
});
