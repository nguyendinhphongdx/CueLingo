import type { SttInput } from '../v1';

/** Inputs only: the regression audio lives in ml/eval, not in the repo. `expectEmpty` marks non-speech clips. */
export const sttFixtures: { name: string; input: SttInput; expectEmpty?: boolean }[] = [
  { name: 'vi: plain meeting sentence', input: { language: 'vi' } },
  { name: 'vi: sentence with English product terms', input: { language: 'vi' } },
  { name: 'vi: silence or noise only', input: { language: 'vi' }, expectEmpty: true },
  { name: 'en: plain meeting sentence', input: { language: 'en' } },
];
