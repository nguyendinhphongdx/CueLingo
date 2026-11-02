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
  // Japanese meeting (ADR 0013): same checks, spoken in Japanese.
  {
    name: 'ja: deadline request',
    input: { text: '金曜日まで納期を延ばしていただけますか。', language: 'ja' },
    mustContain: ['thứ Sáu'],
  },
  {
    name: 'ja: glossary term is respected',
    input: {
      text: 'SLA違反の原因はロードバランサーです。',
      language: 'ja',
      glossary: [{ term: 'SLA違反', translation: 'vi phạm SLA' }],
    },
    mustContain: ['vi phạm SLA'],
  },
  {
    name: 'ja: context disambiguates',
    input: {
      text: '一旦保留にしましょう。',
      language: 'ja',
      previous: ['時間がなくなってきました。', '次は採用の話です。'],
    },
    mustContain: ['hoãn|gác|để sau|tạm'],
  },
  {
    name: 'ja: polite non-commitment',
    input: { text: '前向きに検討させていただきます。', language: 'ja' },
    mustContain: ['xem xét|cân nhắc|suy nghĩ'],
  },
  {
    name: 'ja: already Vietnamese',
    input: { text: 'Xin chào mọi người.', language: 'ja' },
    mustContain: ['chào mọi người'],
  },
];
