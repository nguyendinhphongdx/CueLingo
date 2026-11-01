import type { TranslateInput } from '../v1';

/** Small regression set; `mustContain` entries are Vietnamese fragments (`a|b` = either) a correct translation keeps. */
export const translateFixtures: { name: string; input: TranslateInput; mustContain: string[] }[] = [
  {
    name: 'plain business sentence',
    input: { text: 'Can we push back the deadline to Friday?' },
    mustContain: ['thứ Sáu'],
  },
  {
    name: 'glossary term is respected',
    input: {
      text: 'The SLA breach was caused by the load balancer.',
      glossary: [{ term: 'SLA breach', translation: 'vi phạm SLA' }],
    },
    mustContain: ['vi phạm SLA'],
  },
  {
    name: 'context disambiguates',
    input: {
      text: 'Let us table it for now.',
      previous: ['We are running out of time.', 'The next topic is hiring.'],
    },
    mustContain: ['hoãn|gác|để sau'],
  },
  { name: 'already Vietnamese', input: { text: 'Xin chào mọi người.' }, mustContain: ['Xin chào'] },
];
