import { Readable } from 'node:stream';
import {
  createPartsBuilder,
  createToolRegistry,
  estimateTokens,
  runTurn,
  type ModelMessage,
  type AgentPermission,
  type AgentPlugin,
  type ModelPort,
  type TurnLimits,
} from '@cuelingo/agent';
import { AGENT_PROMPT_VERSION, buildAgentPrompt } from '@cuelingo/prompts';
import {
  ErrorCode,
  type AdminAgentStatus,
  type AgentStreamEvent,
  type Message,
  type MessagePart,
  type MessageStatus,
  type SendMessageRequest,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { ConversationsRepository } from '../conversations';
import type { AgentRepository } from './agent.repository';
import {
  DEFAULT_QUOTA_LIMITS,
  isExceeded,
  quotaWindow,
  toQuota,
  type AgentQuotaLimits,
  type AgentUsage,
} from './agent.quota';
import {
  corePlugin,
  buildCoreCapabilities,
  scopeCapabilities,
  type CoreCapabilities,
  type CoreServices,
} from './plugins/core';

/** The turn carries every capability; the registry narrows them per plugin by what it declared. */
const ALL_PERMISSIONS: AgentPermission[] = [
  'phrases:read',
  'phrases:write',
  'lookup',
  'cards',
  'html',
];

export type AgentService = ReturnType<typeof createAgentService>;

export interface AgentServiceDeps {
  /** False (flag off or no AI key) answers every turn with 503 `AGENT_DISABLED`. */
  enabled: boolean;
  /** Builds the model for one user's turn. Absent together with `enabled`. */
  model?: (userId: string) => ModelPort;
  conversations: ConversationsRepository;
  usage: AgentRepository;
  /** Plugins to load, in order. Defaults to the built-in `core` plugin; the composition root adds the others. */
  plugins?: Array<AgentPlugin<CoreCapabilities>>;
  /** What the `core` plugin reaches; bound to the signed-in user per turn. */
  services: CoreServices;
  quota?: Partial<AgentQuotaLimits>;
  limits?: Partial<TurnLimits>;
  clock?: () => Date;
}

/** Only ids and counts are logged, never message text. */
export interface AgentLogger {
  warn(fields: Record<string, unknown>, message: string): void;
}

const frame = (event: AgentStreamEvent): string =>
  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

/** Text of the stored messages that go back to the model; steps and cards of earlier turns are not replayed. */
function toHistory(messages: Message[]): ModelMessage[] {
  const history: ModelMessage[] = [];
  for (const message of messages) {
    if (message.status === 'error' || message.status === 'streaming') continue;
    const text = message.parts
      .filter((part): part is Extract<MessagePart, { type: 'text' }> => part.type === 'text')
      .map((part) => part.text)
      .join('');
    if (!text.trim()) continue;
    history.push({ role: message.role, content: text });
  }
  return history;
}

/** A tool still `running` when the turn ended never finished; do not store it as running. */
const settleParts = (parts: MessagePart[]): MessagePart[] =>
  parts.map((part) =>
    part.type === 'tool_step' && part.status === 'running' ? { ...part, status: 'error' } : part,
  );

/**
 * One assistant turn: checks (disabled, busy, owner, quota) → stores the user's message → streams the harness
 * events as SSE while keeping the assistant message up to date → stores the final status.
 */
export function createAgentService(deps: AgentServiceDeps) {
  const limits: AgentQuotaLimits = { ...DEFAULT_QUOTA_LIMITS, ...deps.quota };
  const clock = deps.clock ?? (() => new Date());
  const registry = createToolRegistry<CoreCapabilities>({ scope: scopeCapabilities });
  const ready = Promise.all(
    (deps.plugins ?? [corePlugin]).map((plugin) => registry.register(plugin)),
  );
  // The admin's global switch, on top of the deploy gate `deps.enabled`. In memory: a restart turns it back on.
  let switchedOn = true;
  // One running turn per user, whatever the conversation: the daily quota is checked before the user message is
  // stored, so parallel turns would all pass the same check. In memory is enough while the API is a single
  // container (ADR 0011).
  const running = new Set<string>();

  async function usageOf(userId: string): Promise<{ usage: AgentUsage; resetsAt: Date }> {
    const { since, resetsAt } = quotaWindow(clock());
    const [turns, tokens] = await Promise.all([
      deps.conversations.countUserMessagesSince(userId, since),
      deps.usage.tokenUsageSince(userId, since),
    ]);
    return { usage: { turns, ...tokens }, resetsAt };
  }

  const adminStatus = async (): Promise<AdminAgentStatus> => {
    await ready;
    return { enabled: switchedOn, available: deps.enabled, plugins: registry.list() };
  };

  return {
    /** What the admin screen reads and flips. Nothing here touches a turn that is already running. */
    admin: {
      status: adminStatus,
      async setEnabled(enabled: boolean): Promise<AdminAgentStatus> {
        switchedOn = enabled;
        return adminStatus();
      },
      /** `undefined` when no plugin has that id. */
      async setPlugin(id: string, enabled: boolean): Promise<AdminAgentStatus | undefined> {
        await ready;
        const status = enabled ? registry.enable(id) : registry.disable(id);
        return status ? adminStatus() : undefined;
      },
    },
    /**
     * Starts a turn and returns the SSE body. Everything that can refuse the turn throws an `AppError` here,
     * before any byte is streamed, so the client gets a normal JSON error with the right status.
     */
    async send(
      userId: string,
      conversationId: string,
      request: SendMessageRequest,
      log?: AgentLogger,
    ): Promise<Readable> {
      if (!deps.enabled || !switchedOn || !deps.model) {
        throw new AppError(ErrorCode.AgentDisabled, 'The assistant is turned off');
      }
      // Keyed by user only, so probing someone else's conversation id never reveals that it is busy.
      const lockKey = userId;
      if (running.has(lockKey)) {
        throw new AppError(ErrorCode.Conflict, 'The assistant is still answering you');
      }
      running.add(lockKey);

      let started = false;
      try {
        const detail = await deps.conversations.get(userId, conversationId);
        if (!detail) throw new AppError(ErrorCode.NotFound, 'Conversation not found');

        const before = await usageOf(userId);
        if (isExceeded(before.usage, limits)) {
          throw new AppError(
            ErrorCode.AgentQuotaExceeded,
            'Daily assistant limit reached',
            toQuota(before.usage, limits, before.resetsAt),
          );
        }

        const userMessage = await deps.conversations.appendUserMessage(
          userId,
          conversationId,
          request.content,
        );
        const assistant = userMessage
          ? await deps.conversations.beginAssistantMessage(userId, conversationId)
          : null;
        if (!assistant) throw new AppError(ErrorCode.NotFound, 'Conversation not found');
        await ready;

        const language = request.language ?? detail.conversation.language;
        const controller = new AbortController();
        const out = new Readable({
          read() {},
          // Fastify destroys the body when the client goes away: that is the user's "stop".
          destroy(error, callback) {
            controller.abort();
            callback(error);
          },
        });
        const pump = async (): Promise<void> => {
          const parts = createPartsBuilder();
          const spent = { input: 0, output: 0 };
          let persisted = false;

          const persist = async (status?: MessageStatus): Promise<void> => {
            try {
              await deps.conversations.updateMessage(userId, assistant!.id, {
                parts: settleParts(parts.parts()),
                ...(status
                  ? {
                      status,
                      promptVersion: AGENT_PROMPT_VERSION,
                      inputTokens: spent.input,
                      outputTokens: spent.output,
                    }
                  : {}),
              });
            } catch {
              log?.warn(
                { conversationId, messageId: assistant!.id },
                'assistant message not saved',
              );
            }
          };
          const finish = async (status: MessageStatus): Promise<void> => {
            if (persisted) return;
            persisted = true;
            await persist(status);
            running.delete(lockKey);
          };
          const write = (event: AgentStreamEvent) => {
            if (!out.destroyed) out.push(frame(event));
          };

          try {
            const turnTokens = () => spent.input + spent.output;
            for await (const event of runTurn<CoreCapabilities>({
              model: deps.model!(userId),
              registry,
              history: toHistory(detail.messages),
              userMessage: request.content,
              language,
              capabilities: buildCoreCapabilities(deps.services, userId, language, ALL_PERMISSIONS),
              signal: controller.signal,
              limits: deps.limits,
              reservedTokens: estimateTokens(buildAgentPrompt({ language }).system),
              hooks: {
                async beforeStep(step) {
                  if (step === 0) return true; // checked above, before anything was stored
                  const fresh = await usageOf(userId);
                  // The `ai_call` events are written asynchronously, so also count what this turn has used.
                  const tokens = Math.max(fresh.usage.tokens, before.usage.tokens + turnTokens());
                  return !isExceeded({ ...fresh.usage, tokens }, limits);
                },
                async afterStep({ inputTokens, outputTokens }) {
                  spent.input += inputTokens ?? 0;
                  spent.output += outputTokens ?? 0;
                  await persist();
                },
              },
            })) {
              parts.apply(event);
              if (event.type === 'done') {
                // Stored (and the user's lock released) before the client sees `done`, so a refetch or the
                // next message right after it finds the final state.
                await finish(event.status);
              } else if (event.type === 'tool_result' || event.type === 'card') {
                await persist();
              }
              write(event);
            }
          } catch {
            // `runTurn` does not throw; this is a bug or a lost connection to the database.
            log?.warn({ conversationId }, 'assistant turn failed');
            write({ type: 'error', code: ErrorCode.AgentFailed });
            write({ type: 'done', status: 'error' });
          } finally {
            await finish('error');
            if (!out.destroyed) out.push(null);
          }
        };
        started = true;
        void pump();
        return out;
      } finally {
        if (!started) running.delete(lockKey);
      }
    },
  };
}
