/** Default limits of one turn (plan ai-agent, "Quota mặc định"). Callers may lower them, tests do. */
export interface TurnLimits {
  /** Model steps per turn. Reaching it ends the turn as `limited`. */
  maxSteps: number;
  /** Write-tool calls per turn; extra calls get a failed result instead of running. */
  maxWriteCalls: number;
  /** All tool calls per turn, read tools included; extra calls get a failed result instead of running. */
  maxToolCalls: number;
  /** Wall-clock budget of the whole turn; running out ends it as `limited`. */
  turnTimeoutMs: number;
  /** Estimated tokens of the messages sent to the model. */
  contextBudgetTokens: number;
  /** One tool run. */
  toolTimeoutMs: number;
}

export const DEFAULT_LIMITS: TurnLimits = {
  maxSteps: 6,
  maxWriteCalls: 3,
  maxToolCalls: 8,
  turnTimeoutMs: 60_000,
  contextBudgetTokens: 24_000,
  toolTimeoutMs: 8_000,
};

/** Tool output kept in the model context, in UTF-8 bytes. */
export const MAX_TOOL_OUTPUT_BYTES = 2_048;

/** Circuit breaker of a plugin's tools (plan ai-agent, "Cô lập lỗi"). */
export const BREAKER = {
  /** Consecutive failed runs of one tool that switch its plugin off. */
  failureThreshold: 3,
  /** How long the plugin stays off; after it, the next call is a trial (half-open). */
  cooldownMs: 10 * 60_000,
} as const;
