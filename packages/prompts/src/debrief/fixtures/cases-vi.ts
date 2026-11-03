import type { DebriefPromptInput } from '../v1';

/** A short Vietnamese meeting (ADR 0014): the debrief is written in Vietnamese with no learning blocks. */
export const debriefViFixtures: { name: string; input: DebriefPromptInput }[] = [
  {
    name: 'họp kế hoạch phát hành bằng tiếng Việt',
    input: {
      language: 'vi',
      segments: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          source: 'system',
          textEn: 'Chúng ta thống nhất phát hành bản beta vào thứ Sáu tuần này.',
        },
        {
          id: '88888888-8888-4888-8888-888888888888',
          source: 'mic',
          textEn: 'Em sẽ chuẩn bị ghi chú phát hành trước thứ Năm.',
        },
        {
          id: '99999999-9999-4999-8999-999999999999',
          source: 'system',
          textEn: 'Anh Nam phụ trách kiểm thử, nếu lỗi nghiêm trọng thì hoãn sang tuần sau.',
        },
      ],
    },
  },
];
