/**
 * @cuelingo/prompts — Prompt có phiên bản cho từng tác vụ AI, kèm schema đầu ra và fixture test.
 * Design: apps/docs/docs/04-modules/05-packages/prompts.md
 */
export * from './translate/v1';
export { translateFixtures } from './translate/fixtures/cases';
export * from './lookup/v1';
export { lookupFixtures } from './lookup/fixtures/cases';
export * from './recap/v1';
export { recapFixtures } from './recap/fixtures/cases';
export * from './compose/v1';
export { composeFixtures } from './compose/fixtures/cases';
