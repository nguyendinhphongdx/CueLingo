# Shared packages

TypeScript packages shared by apps and services. Each package is one module with no dependency on any app.

| Package                                    | Role                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------- |
| [`@cuelingo/shared`](shared)               | Domain types, API/WebSocket schemas, event catalog                   |
| [`@cuelingo/core-sdk`](core-sdk)           | Client SDK for desktop and web                                       |
| [`@cuelingo/learner-model`](learner-model) | Pure Learner Model logic (FSRS, lexicon, comprehension, Assist Dial) |
| [`@cuelingo/ai-gateway`](ai-gateway)       | STT/LLM/TTS provider abstraction, routing, cost logging              |
| [`@cuelingo/prompts`](prompts)             | Versioned prompts and output schemas                                 |
| [`@cuelingo/ui`](ui)                       | Shared React components                                              |

Design: [apps/docs/docs/04-modules/05-packages/README.md](../apps/docs/docs/04-modules/05-packages/README.md)
