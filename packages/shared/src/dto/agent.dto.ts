import { z } from 'zod';
import { ErrorCode } from '../errors/error-code';
import { LearnableLanguageSchema } from '../languages';

/** AI assistant (agent): conversations, messages, the SSE stream of one turn, and the cards the model can show. */

export const MAX_AGENT_MESSAGE_CHARS = 4000;

const ShortText = z.string().trim().min(1).max(300);

/**
 * Cards the model shows through the `show_card` tool. Layer 1 of ADR 0019: fixed shapes, rendered by
 * `@cuelingo/ui`, never code. Each card is `{kind, data}` so a plugin can add a kind without touching others.
 */
export const AgentCardSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('flashcards'),
    data: z
      .object({
        title: ShortText.optional(),
        cards: z
          .array(z.object({ front: ShortText, back: z.string().trim().min(1).max(500) }).strict())
          .min(1)
          .max(20),
      })
      .strict(),
  }),
  z.object({
    kind: z.literal('cloze'),
    data: z
      .object({
        title: ShortText.optional(),
        items: z
          .array(
            z
              .object({
                /** The sentence with `___` where the answer goes. */
                sentence: z.string().trim().min(1).max(300).includes('___'),
                answer: z.string().trim().min(1).max(80),
                hint: z.string().trim().max(200).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(10),
      })
      .strict(),
  }),
  z.object({
    kind: z.literal('quiz_choice'),
    data: z
      .object({
        question: z.string().trim().min(1).max(400),
        options: z.array(ShortText).min(2).max(6),
        answerIndex: z.number().int().min(0),
        explanation: z.string().trim().max(600).optional(),
      })
      .strict()
      .refine((d) => d.answerIndex < d.options.length, {
        path: ['answerIndex'],
        message: 'answerIndex must point to an option',
      }),
  }),
  z.object({
    kind: z.literal('compare_table'),
    data: z
      .object({
        title: ShortText.optional(),
        columns: z.array(ShortText).min(2).max(5),
        rows: z
          .array(z.array(z.string().trim().max(300)).min(1).max(5))
          .min(1)
          .max(12),
      })
      .strict()
      .refine((d) => d.rows.every((r) => r.length === d.columns.length), {
        path: ['rows'],
        message: 'every row needs one cell per column',
      }),
  }),
  z.object({
    kind: z.literal('phrase_list'),
    data: z
      .object({
        title: ShortText.optional(),
        items: z
          .array(
            z
              .object({
                phrase: z.string().trim().min(1).max(200),
                meaningVi: z.string().trim().max(500).optional(),
                example: z.string().trim().max(300).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(20),
      })
      .strict(),
  }),
]);
export type AgentCard = z.infer<typeof AgentCardSchema>;
export type AgentCardKind = AgentCard['kind'];

/** What the user sees of one tool call, kept with the message so a reopened conversation shows the same steps. */
export const ToolStepStatusSchema = z.enum(['running', 'ok', 'error']);
export type ToolStepStatus = z.infer<typeof ToolStepStatusSchema>;

export const MessagePartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).strict(),
  z
    .object({
      type: z.literal('tool_step'),
      callId: z.string().min(1).max(64),
      tool: z.string().min(1).max(64),
      status: ToolStepStatusSchema,
      /** One short Vietnamese sentence; never raw tool output. */
      summary: z.string().max(300).optional(),
    })
    .strict(),
  z.object({ type: z.literal('card'), card: AgentCardSchema }).strict(),
]);
export type MessagePart = z.infer<typeof MessagePartSchema>;

export const MessageStatusSchema = z.enum(['streaming', 'complete', 'stopped', 'error', 'limited']);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const MessageSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    seq: z.number().int().min(0),
    role: z.enum(['user', 'assistant']),
    parts: z.array(MessagePartSchema),
    status: MessageStatusSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();
export type Message = z.infer<typeof MessageSchema>;

export const ConversationSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().max(120),
    language: LearnableLanguageSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type Conversation = z.infer<typeof ConversationSchema>;

export const ConversationListSchema = z.object({ items: z.array(ConversationSchema) }).strict();
export type ConversationList = z.infer<typeof ConversationListSchema>;

/** A conversation with its messages, oldest first. */
export const ConversationDetailSchema = z
  .object({ conversation: ConversationSchema, messages: z.array(MessageSchema) })
  .strict();
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

export const CreateConversationRequestSchema = z
  .object({ language: LearnableLanguageSchema.optional() })
  .strict();
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;

export const RenameConversationRequestSchema = z
  .object({ title: ConversationSchema.shape.title.min(1) })
  .strict();
export type RenameConversationRequest = z.infer<typeof RenameConversationRequestSchema>;

export const SendMessageRequestSchema = z
  .object({
    content: z.string().trim().min(1).max(MAX_AGENT_MESSAGE_CHARS),
    language: LearnableLanguageSchema.optional(),
  })
  .strict();
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const AgentDoneStatusSchema = z.enum(['complete', 'stopped', 'limited', 'error']);
export type AgentDoneStatus = z.infer<typeof AgentDoneStatusSchema>;

/** One server-sent event of a turn. `done` is always the last event; a failed turn sends `error` and then `done{error}`. */
export const AgentStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), status: z.literal('thinking') }).strict(),
  z.object({ type: z.literal('text_delta'), text: z.string() }).strict(),
  z
    .object({
      type: z.literal('tool_call'),
      callId: z.string().min(1).max(64),
      tool: z.string().min(1).max(64),
    })
    .strict(),
  z
    .object({
      type: z.literal('tool_result'),
      callId: z.string().min(1).max(64),
      tool: z.string().min(1).max(64),
      ok: z.boolean(),
      summary: z.string().max(300).optional(),
    })
    .strict(),
  z.object({ type: z.literal('card'), card: AgentCardSchema }).strict(),
  z.object({ type: z.literal('done'), status: AgentDoneStatusSchema }).strict(),
  z.object({ type: z.literal('error'), code: z.enum(ErrorCode) }).strict(),
]);
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

/** The user's daily allowance and what they have used since `resetsAt - 24h`. */
export const AgentQuotaSchema = z
  .object({
    turns: z.object({ used: z.number().int().min(0), limit: z.number().int().min(0) }).strict(),
    tokens: z.object({ used: z.number().int().min(0), limit: z.number().int().min(0) }).strict(),
    costUsd: z.object({ used: z.number().min(0), limit: z.number().min(0) }).strict(),
    resetsAt: z.iso.datetime(),
  })
  .strict();
export type AgentQuota = z.infer<typeof AgentQuotaSchema>;
