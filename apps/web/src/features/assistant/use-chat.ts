import { ApiError } from '@cuelingo/core-sdk';
import type { ConversationDetail, LanguageCode } from '@cuelingo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { client } from '../../lib/client';
import { describeAgentError, describeAgentErrorCode, describeError } from '../../lib/errors';
import {
  applyStreamEvent,
  displayMessages,
  emptyDraft,
  isPendingVisible,
  settleConversation,
  type PendingTurn,
} from './chat-state';
import { CONVERSATIONS_KEY } from './use-conversations';

export const conversationKey = (id: string) => ['conversation', id] as const;

/**
 * One chat: the stored conversation, plus the turn being sent. The user's message shows at once, the
 * reply streams into a draft, and when the turn ends the stored conversation is read again so what is
 * shown is what is saved. Stop aborts the request; the server keeps the text written so far.
 */
export function useChat({
  conversationId,
  language,
  onCreated,
}: {
  conversationId: string | null;
  /** Language of a conversation created by the first message. */
  language: LanguageCode;
  onCreated: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: conversationKey(conversationId ?? ''),
    queryFn: () => client.conversations.get(conversationId as string),
    enabled: conversationId !== null,
  });
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const stored = detail.data?.messages;

  // Leaving the chat the turn belongs to stops the turn: its reply would have nowhere to show.
  useEffect(() => {
    if (pending && !isPendingVisible(pending, conversationId)) abort.current?.abort();
  }, [conversationId, pending]);
  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(
    /** Sends a message. Resolves false (and keeps nothing) when it could not start, so the caller can restore the text. */
    async (text: string): Promise<boolean> => {
      const content = text.trim();
      if (!content || busy.current) return false;
      busy.current = true;
      setError(null);
      const controller = new AbortController();
      abort.current = controller;

      let id = conversationId;
      let createdId: string | null = null;
      let started = false;
      let failure: unknown = null;
      let draft = emptyDraft();
      setPending({
        viewId: id,
        targetId: id,
        base: id ? (stored ?? []) : [],
        userText: content,
        draft,
      });

      try {
        if (!id) {
          const created = await client.conversations.create({ language });
          id = created.id;
          setPending((p) => (p ? { ...p, targetId: created.id } : p));
          createdId = created.id;
          void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        }
        await client.agent.sendMessage(
          id,
          { content },
          {
            signal: controller.signal,
            onEvent: (event) => {
              started = true;
              draft = applyStreamEvent(draft, event);
              setPending((p) => (p ? { ...p, draft } : p));
            },
          },
        );
      } catch (err) {
        failure = err;
      }

      // Nothing reached the server's reply: undo the optimistic message and let the person retry.
      if (!started && (failure || controller.signal.aborted)) {
        setPending(null);
        if (failure) setError(describeAgentError(failure));
        abort.current = null;
        busy.current = false;
        return false;
      }

      // Stopped by the person: the server saves what was written, so show that while it is read back.
      if (draft.status === 'streaming' && controller.signal.aborted) {
        draft = { ...draft, status: 'stopped' };
        setPending((p) => (p ? { ...p, draft } : p));
      }

      if (id) {
        const target = id;
        const messages = await settleConversation(async () => {
          const fresh = await queryClient.fetchQuery<ConversationDetail>({
            queryKey: conversationKey(target),
            queryFn: () => client.conversations.get(target),
            staleTime: 0,
          });
          return fresh.messages;
        });
        void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        if (!messages) setError(describeError(new ApiError(0, 'NETWORK_ERROR', 'reload failed')));
      }

      if (failure && !controller.signal.aborted) setError(describeAgentError(failure));
      else if (draft.errorCode) setError(describeAgentErrorCode(draft.errorCode));

      setPending(null);
      abort.current = null;
      busy.current = false;
      // Moving to the new conversation's address remounts the page, which would abort the stream:
      // do it only once the turn is over and the stored conversation is already in the cache.
      if (createdId) onCreated(createdId);
      return true;
    },
    [conversationId, language, onCreated, queryClient, stored],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  return {
    conversation: detail.data?.conversation ?? null,
    messages: displayMessages(stored ?? [], pending, conversationId),
    loading: conversationId !== null && detail.isPending,
    loadError: describeError(detail.error),
    sending: pending !== null,
    /** A turn is on screen for this page, including a new chat before its id is in the address. */
    turnVisible: isPendingVisible(pending, conversationId),
    error,
    clearError: () => setError(null),
    send,
    stop,
  };
}
