import type { LanguageCode, PlacementPassage } from '@cuelingo/shared';

/** A passage with its answer; the answer never leaves the server until a test is submitted. */
export interface PlacementItem extends PlacementPassage {
  correctChoice: number;
}

/**
 * Six passages in rising difficulty: slower and plainer first, then faster speech, idiom and
 * implication. Each question asks for the gist, in Vietnamese, so the score is about listening.
 */
const EN: PlacementItem[] = [
  {
    id: 'en-1',
    text: 'Hi everyone. The meeting is at three o’clock today, in room twelve.',
    question: 'Cuộc họp diễn ra khi nào?',
    choices: ['3 giờ chiều nay', '12 giờ trưa nay', '3 giờ chiều mai'],
    correctChoice: 0,
  },
  {
    id: 'en-2',
    text: 'Can you send me the report by Friday? I need it before the call with the client on Monday.',
    question: 'Người nói cần gì và khi nào?',
    choices: [
      'Báo cáo, trước thứ Sáu',
      'Cuộc gọi với khách, vào thứ Sáu',
      'Báo cáo, vào thứ Hai sau cuộc gọi',
    ],
    correctChoice: 0,
  },
  {
    id: 'en-3',
    text: 'We were going to launch next week, but the testing team found a bug, so we are pushing it back by a few days.',
    question: 'Điều gì xảy ra với kế hoạch ra mắt?',
    choices: ['Bị hoãn vài ngày', 'Được đẩy lên sớm hơn', 'Giữ nguyên lịch'],
    correctChoice: 0,
  },
  {
    id: 'en-4',
    text: 'I do not think we can commit to that deadline unless we bring in two more engineers, and even then it would be tight.',
    question: 'Người nói nghĩ gì về thời hạn?',
    choices: [
      'Chỉ kịp nếu thêm người, và vẫn sát nút',
      'Chắc chắn kịp với đội hiện tại',
      'Không cần thêm người vì thời hạn đã dời',
    ],
    correctChoice: 0,
  },
  {
    id: 'en-5',
    text: 'To be honest, the numbers look fine on paper, but I would not take them at face value; the sample was small and mostly from one region.',
    question: 'Người nói đánh giá các con số thế nào?',
    choices: [
      'Có vẻ ổn nhưng không nên tin hoàn toàn vì mẫu nhỏ, lệch vùng',
      'Rất đáng tin vì mẫu đại diện nhiều vùng',
      'Sai hoàn toàn và cần bỏ đi',
    ],
    correctChoice: 0,
  },
  {
    id: 'en-6',
    text: 'Look, I am not saying we should scrap the whole plan, but if we keep ignoring the churn numbers, we are going to be having a very different conversation by the end of the quarter.',
    question: 'Ý chính của người nói là gì?',
    choices: [
      'Cần để ý tỷ lệ khách rời đi, nếu không sẽ gặp rắc rối vào cuối quý',
      'Nên huỷ toàn bộ kế hoạch ngay',
      'Tỷ lệ khách rời đi không đáng lo',
    ],
    correctChoice: 0,
  },
];

/** The answer is written first above; rotate the choices so the right one is not always first. */
const rotated = (items: PlacementItem[]): PlacementItem[] =>
  items.map((item, index) => {
    const shift = index % item.choices.length;
    const choices = item.choices.map((_, i, all) => all[(i - shift + all.length) % all.length]!);
    return { ...item, choices, correctChoice: (item.correctChoice + shift) % choices.length };
  });

const TESTS: Partial<Record<LanguageCode, PlacementItem[]>> = { en: rotated(EN) };

/** The test for a language, or null when none exists yet for it. */
export const placementItems = (language: LanguageCode): PlacementItem[] | null =>
  TESTS[language] ?? null;
