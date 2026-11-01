import type { RecapRequest } from '@cuelingo/shared';

export const recapFixtures: { name: string; input: RecapRequest }[] = [
  {
    name: 'decision and owner',
    input: {
      sentences: [
        { speaker: 'Mia', text: 'We will ship Friday.' },
        { speaker: 'Lee', text: 'I will prepare the release notes.' },
      ],
    },
  },
  { name: 'single line', input: { sentences: [{ text: 'Let us revisit the budget tomorrow.' }] } },
  {
    name: 'contrasting views',
    input: {
      sentences: [
        { speaker: 'A', text: 'The pilot is ready.' },
        { speaker: 'B', text: 'Security review is still pending.' },
      ],
    },
  },
];
