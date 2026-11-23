import type { LessonContent } from '@cuelingo/shared';
import type { LessonPromptInput } from '../v1';

/** Inputs the evaluation script and the tests build prompts from: every goal, two levels. */
export const lessonFixtures: { name: string; input: LessonPromptInput }[] = [
  {
    name: 'standup done a2',
    input: { goalKey: 'standup', lessonKey: 'done', level: 'a2', language: 'en' },
  },
  {
    name: 'standup blocker b2',
    input: { goalKey: 'standup', lessonKey: 'blocker', level: 'b2', language: 'en' },
  },
  {
    name: 'client-status risk b1',
    input: { goalKey: 'client-status', lessonKey: 'risk', level: 'b1', language: 'en' },
  },
  {
    name: 'negotiation decline c1',
    input: { goalKey: 'negotiation', lessonKey: 'decline', level: 'c1', language: 'en' },
  },
  {
    name: 'interview project b2',
    input: { goalKey: 'interview', lessonKey: 'project', level: 'b2', language: 'en' },
  },
  {
    name: 'small-talk greet a2',
    input: { goalKey: 'small-talk', lessonKey: 'greet', level: 'a2', language: 'en' },
  },
];

const phrase = (en: string, meaningVi: string, register: 'formal' | 'neutral' | 'casual') => ({
  en,
  meaningVi,
  register,
});

const keyPhrases = [
  phrase('I finished', 'tôi đã hoàn thành', 'neutral'),
  phrase('I worked on', 'tôi đã làm việc với', 'neutral'),
  phrase('I fixed the bug in', 'tôi đã sửa lỗi trong', 'neutral'),
  phrase('It is ready for review', 'nó đã sẵn sàng để xem xét', 'neutral'),
  phrase('I am still working on', 'tôi vẫn đang làm', 'casual'),
];

const question = (
  kind: 'choice' | 'cloze',
  prompt: string,
  options: string[],
  answer: string,
  phraseText: string,
) => ({
  kind,
  prompt,
  options,
  answer,
  explanationVi: 'Đây là cách nói tự nhiên trong buổi họp.',
  phrase: phraseText,
});

/** A lesson that passes `checkLessonOutput`; tests break one thing at a time. */
export const lessonSample: LessonContent = {
  situation: {
    descriptionVi: 'Bạn đang ở buổi họp stand-up sáng và cần báo ngắn gọn việc đã làm hôm qua.',
    keyPhrases,
  },
  dialogue: {
    roles: { a: 'Team lead', b: 'Developer' },
    turns: [
      {
        speaker: 'a',
        en: 'Good morning. What did you do yesterday?',
        vi: 'Chào buổi sáng. Hôm qua bạn đã làm gì?',
      },
      { speaker: 'b', en: 'I finished the login page.', vi: 'Tôi đã hoàn thành trang đăng nhập.' },
      { speaker: 'a', en: 'Great. Anything else?', vi: 'Tốt. Còn gì nữa không?' },
      {
        speaker: 'b',
        en: 'I fixed the bug in the payment form.',
        vi: 'Tôi đã sửa lỗi trong biểu mẫu thanh toán.',
      },
      { speaker: 'a', en: 'Is it done?', vi: 'Xong chưa?' },
      { speaker: 'b', en: 'It is ready for review.', vi: 'Nó đã sẵn sàng để xem xét.' },
      { speaker: 'a', en: 'And today?', vi: 'Còn hôm nay?' },
      {
        speaker: 'b',
        en: 'I worked on the profile page too, and I am still working on the report.',
        vi: 'Tôi cũng làm trang hồ sơ, và vẫn đang làm báo cáo.',
      },
      {
        speaker: 'a',
        en: 'Thanks. Please send me the link.',
        vi: 'Cảm ơn. Gửi mình đường dẫn nhé.',
      },
    ],
  },
  practice: {
    prompts: [
      { taskVi: 'Báo rằng bạn đã hoàn thành trang hồ sơ người dùng.', targetPhrase: 'I finished' },
      {
        taskVi: 'Nói bạn đã sửa một lỗi trong trang giỏ hàng.',
        targetPhrase: 'I fixed the bug in',
      },
      {
        taskVi: 'Nói bạn vẫn đang làm phần báo cáo.',
        targetPhrase: 'I am still working on',
        hintEn: 'Use the report.',
      },
    ],
  },
  quiz: {
    questions: [
      question(
        'choice',
        'I finished',
        ['tôi đã hoàn thành', 'tôi sẽ bắt đầu', 'tôi không biết'],
        'tôi đã hoàn thành',
        'I finished',
      ),
      question(
        'choice',
        'It is ready for review',
        ['nó cần làm lại', 'nó đã sẵn sàng để xem xét', 'nó bị hỏng'],
        'nó đã sẵn sàng để xem xét',
        'It is ready for review',
      ),
      question(
        'cloze',
        '____ the login page yesterday.',
        ['I finished', 'I am still working on', 'I will fix'],
        'I finished',
        'I finished',
      ),
      question(
        'cloze',
        '____ the payment form.',
        ['I fixed the bug in', 'I finished', 'It is ready for review'],
        'I fixed the bug in',
        'I fixed the bug in',
      ),
      question(
        'choice',
        'Bạn muốn nói mình vẫn chưa xong việc.',
        ['I finished', 'I am still working on', 'It is ready for review'],
        'I am still working on',
        'I am still working on',
      ),
      question(
        'choice',
        'I worked on',
        ['tôi đã làm việc với', 'tôi đã quên', 'tôi sẽ hỏi'],
        'tôi đã làm việc với',
        'I worked on',
      ),
    ],
  },
};
