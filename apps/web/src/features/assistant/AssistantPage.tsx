'use client';

import type { Conversation } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { ConfirmDialog } from '@cuelingo/ui/components/confirm-dialog';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import { WordActionsMenu } from '@cuelingo/ui/components/word-actions-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { client } from '../../lib/client';
import { useLanguage } from '../../lib/language';
import { ChatView } from './ChatView';
import { ConversationList, UNTITLED } from './ConversationList';
import { RenameForm } from './RenameForm';
import { useChat } from './use-chat';
import { useConversations } from './use-conversations';
import { useHtmlBlocks } from './use-html-blocks';
import { useWordActions } from './use-word-actions';

const backLink =
  'focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent focus-visible:ring-2 focus-visible:outline-none';

/**
 * Assistant (experimental): `/assistant` starts a chat and lists earlier ones; `/assistant/<id>` is one
 * conversation. Streaming, Stop and word actions live in the hooks; this component only lays them out.
 */
export function AssistantPage({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const { language } = useLanguage();
  const id = conversationId ?? null;
  const conversations = useConversations();
  const chat = useChat({
    conversationId: id,
    language,
    onCreated: (created) => router.replace(`/assistant/${created}`),
  });
  const blockLanguage = chat.conversation?.language ?? language;
  const words = useWordActions(blockLanguage);
  const renderHtmlBlock = useHtmlBlocks(blockLanguage);
  const [renaming, setRenaming] = useState(false);
  const [toDelete, setToDelete] = useState<Conversation | null>(null);

  const inChat = id !== null || chat.turnVisible;
  const title = chat.conversation?.title || UNTITLED;

  const confirmDelete = async () => {
    const target = toDelete;
    if (!target) return;
    try {
      await conversations.remove(target.id);
      setToDelete(null);
      if (target.id === id) router.replace('/assistant');
    } catch {
      setToDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title={inChat ? title : 'Trợ lý AI'}
        description={
          inChat
            ? undefined
            : 'Tính năng thử nghiệm: hỏi về tiếng Anh công sở và chuẩn bị cho cuộc họp.'
        }
        action={
          inChat ? (
            <Link href="/assistant" className={backLink}>
              Tất cả cuộc trò chuyện
            </Link>
          ) : undefined
        }
      />

      {inChat && chat.conversation ? (
        renaming ? (
          <RenameForm
            title={title}
            saving={conversations.renaming}
            onCancel={() => setRenaming(false)}
            onSave={(next) =>
              void conversations
                .rename({ id: chat.conversation!.id, title: next })
                .then(() => setRenaming(false))
                .catch(() => undefined)
            }
          />
        ) : (
          <div className="-mt-3 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => setRenaming(true)}
            >
              Đổi tên
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => setToDelete(chat.conversation)}
            >
              Xoá
            </Button>
          </div>
        )
      ) : null}

      <ChatView
        messages={chat.messages}
        sending={chat.sending}
        error={chat.error ?? words.error ?? conversations.error}
        loading={chat.loading}
        loadError={chat.loadError}
        onSend={chat.send}
        onStop={chat.stop}
        onDismissError={() => {
          chat.clearError();
          words.clearError();
        }}
        loadAudio={client.tts.speak}
        renderHtmlBlock={renderHtmlBlock}
        onWordDoubleClick={words.onDoubleClick}
      />

      {!inChat ? (
        <Section title="Cuộc trò chuyện trước">
          <Card>
            <CardContent className="pt-6">
              {conversations.loading ? (
                <p className="text-muted-foreground text-sm">Đang tải…</p>
              ) : (
                <ConversationList
                  items={conversations.conversations}
                  renaming={conversations.renaming}
                  onRename={(convId, next) => conversations.rename({ id: convId, title: next })}
                  onDelete={setToDelete}
                />
              )}
            </CardContent>
          </Card>
        </Section>
      ) : null}

      {words.menu ? (
        <WordActionsMenu
          key={`${words.menu.word}:${words.menu.position.x}:${words.menu.position.y}`}
          word={words.menu.word}
          position={words.menu.position}
          saved={words.saved}
          saving={words.saving}
          lookup={words.lookup}
          speakStatus={words.speakStatus}
          onLookup={() => void words.lookupWord()}
          onSpeak={words.speakWord}
          onSave={() => void words.saveWord()}
          onClose={words.close}
        />
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        title="Xoá cuộc trò chuyện?"
        confirmLabel="Xoá"
        cancelLabel="Huỷ"
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      >
        “{toDelete?.title || UNTITLED}” sẽ biến mất khỏi danh sách và bị xoá hẳn sau 7 ngày. Cụm từ
        đã lưu vẫn còn trong Cụm từ.
      </ConfirmDialog>
    </>
  );
}
