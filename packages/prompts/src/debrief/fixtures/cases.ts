import type { DebriefPromptInput } from '../v1';

export const debriefFixtures: { name: string; input: DebriefPromptInput }[] = [
  {
    name: 'release planning in English',
    input: {
      segments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          source: 'system',
          textEn: 'We will ship the beta on Friday.',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          source: 'mic',
          textEn: 'I will prepare release note.',
        },
      ],
    },
  },
  {
    name: 'mixed Vietnamese and English standup',
    input: {
      segments: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          source: 'mic',
          textEn: 'Em đã xong phần login, but the test is still failing.',
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          source: 'system',
          textEn: 'Let us pair after lunch.',
        },
      ],
    },
  },
  {
    name: 'short customer call',
    input: {
      segments: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          source: 'system',
          textEn: 'Could you send the revised quote tomorrow?',
        },
        {
          id: '66666666-6666-4666-8666-666666666666',
          source: 'mic',
          textEn: 'Yes, I send it before noon.',
        },
      ],
    },
  },
];
