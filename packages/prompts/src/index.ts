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
export * from './debrief/v1';
export { debriefFixtures } from './debrief/fixtures/cases';
export * from './stt/v1';
export { sttFixtures } from './stt/fixtures/cases';
export * from './debrief/v2';
export { debriefViFixtures } from './debrief/fixtures/cases-vi';
export * from './debrief/v3';
export * from './debrief/v4';
export * from './debrief/v5';
export { debriefSpeakerFixtures } from './debrief/fixtures/cases-speakers';
export * from './stt/v2';
export * from './stt/v3';
export * from './stt/v4';
export { sttV4Fixtures } from './stt/fixtures/cases-v4';
export { sttV2Fixtures } from './stt/fixtures/cases-v2';
export * from './followup/v1';
export { followupFixtures } from './followup/fixtures/cases';
