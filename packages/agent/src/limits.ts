/** Default limits of one turn (plan ai-agent, "Quota mặc định"). Callers may lower them, tests do. */
export interface TurnLimits {
  /** Model steps per turn. Reaching it ends the turn as `limited`. */
  maxSteps: number;
  /** Write-tool calls per turn; extra calls get a failed result instead of running. */
  maxWriteCalls: number;
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
  turnTimeoutMs: 60_000,
  contextBudgetTokens: 24_000,
  toolTimeoutMs: 8_000,
};

/** Tool output kept in the model context, in UTF-8 bytes. */
export const MAX_TOOL_OUTPUT_BYTES = 2_048;
