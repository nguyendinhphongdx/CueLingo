#!/usr/bin/env node
// SessionStart hook: reminds every session of the CueLingo working loop (soft enforcement, blocks nothing).
// Output schema: hookSpecificOutput.additionalContext on stdout, exit 0.

const directive = [
  'CueLingo working loop active. Read AGENTS.md first.',
  'Classify the task. TRIVIAL (1-2 files, no contract/schema/AI/privacy change): code directly, then `pnpm verify`.',
  'NON-TRIVIAL (>=3 files, several parts, or touches @cuelingo/shared, migrations, events, prompts, user data):',
  'invoke skill `task-loop` BEFORE planning or editing: Delivery Log in apps/docs/docs/06-delivery, gates SPEC -> PLAN -> RESULT, each needs user approval.',
  'Workflows shared with Codex live in apps/docs/docs/05-engineering/workflows/; building a part that does not exist yet follows apps/docs/docs/05-engineering/scaffold/.',
  'Before writing code: find the extension point (apps/docs/docs/05-engineering/01-extension-points.md) and copy the reference module, do not invent a layout.',
  'Work handed to another agent (Codex) goes through a 04-brief.md (apps/docs/docs/05-engineering/agent-collaboration.md); the writer of code never reviews it.',
  'Iron laws: if a skill or agent exists for the job, use it. Never report done while `pnpm verify` is red or the flow was not run for real.',
].join(' ');

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: directive },
  }),
);
