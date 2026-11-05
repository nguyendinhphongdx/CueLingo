import type { Conversation } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import Link from 'next/link';
import { useState } from 'react';
import { RenameForm } from './RenameForm';

/** What the list shows for a chat that has no title yet (it was created but never sent). */
export const UNTITLED = 'Cuộc trò chuyện mới';

/** The person's earlier conversations, newest first, with rename and delete on each row. */
export function ConversationList({
  items,
  renaming,
  onRename,
  onDelete,
}: {
  items: Conversation[];
  renaming: boolean;
  onRename: (id: string, title: string) => Promise<unknown>;
  onDelete: (conversation: Conversation) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Chưa có cuộc trò chuyện nào.</p>;
  }
  return (
    <ul className="divide-y">
      {items.map((conversation) => {
        const title = conversation.title || UNTITLED;
        return (
          <li key={conversation.id} className="flex items-center justify-between gap-3 py-2">
            {editingId === conversation.id ? (
              <div className="min-w-0 flex-1">
                <RenameForm
                  title={title}
                  saving={renaming}
                  onCancel={() => setEditingId(null)}
                  onSave={(next) =>
                    void onRename(conversation.id, next)
                      .then(() => setEditingId(null))
                      .catch(() => undefined)
                  }
                />
              </div>
            ) : (
              <>
                <Link
                  href={`/assistant/${conversation.id}`}
                  className="focus-visible:ring-ring flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="truncate font-medium">{title}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(conversation.updatedAt).toLocaleDateString('vi-VN')}
                  </span>
                </Link>
                <span className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    aria-label={`Đổi tên ${title}`}
                    onClick={() => setEditingId(conversation.id)}
                  >
                    Đổi tên
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    aria-label={`Xoá ${title}`}
                    onClick={() => onDelete(conversation)}
                  >
                    Xoá
                  </Button>
                </span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
