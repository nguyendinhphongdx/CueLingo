import type { DebriefSpeakerInput } from '../v4';

/** Meetings with speaker labels: named, numbered, unlabelled system, and a sentence from before labels existed. */
export const debriefSpeakerFixtures: { name: string; input: DebriefSpeakerInput }[] = [
  {
    name: 'English meeting with a named speaker, a numbered one and an unlabelled one',
    input: {
      segments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          source: 'system',
          speakerLabel: 'speaker_1',
          speakerName: 'Lan',
          textEn: 'We will ship the beta on Friday.',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          source: 'mic',
          speakerLabel: 'me',
          textEn: 'I will prepare release note.',
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          source: 'system',
          speakerLabel: 'speaker_2',
          textEn: 'Can someone own the rollback plan?',
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
    name: 'Vietnamese meeting with a named speaker',
    input: {
      language: 'vi',
      segments: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          source: 'system',
          speakerLabel: 'speaker_1',
          speakerName: 'Nam',
          textEn: 'Anh phụ trách kiểm thử.',
        },
        {
          id: '88888888-8888-4888-8888-888888888888',
          source: 'mic',
          speakerLabel: 'me',
          textEn: 'Em sẽ chuẩn bị ghi chú phát hành.',
        },
      ],
    },
  },
];
