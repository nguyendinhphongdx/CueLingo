import { z } from 'zod';
import { PlacementLevelSchema } from './dto/placement.dto';

/**
 * Goal catalog: the fixed list of goals a person can pick and the six fixed lessons of each (ADR 0025).
 * The titles are the frame; AI only writes the content of a lesson. Design: apps/docs/docs/04-modules/03-api/goals.md
 */

/** A person has at most this many goals at once. */
export const GOAL_MAX = 3;
/** Lessons in every goal. */
export const GOAL_LESSON_COUNT = 6;

/** Only English is taught in the first version; another language needs its own evaluation set. */
export const GOAL_LANGUAGES = ['en'] as const;
export const GoalLanguageSchema = z.enum(GOAL_LANGUAGES);
export type GoalLanguage = z.infer<typeof GoalLanguageSchema>;
export const DEFAULT_GOAL_LANGUAGE: GoalLanguage = 'en';

export const GoalLevelSchema = PlacementLevelSchema;
export type GoalLevel = z.infer<typeof GoalLevelSchema>;
export const GOAL_LEVELS = GoalLevelSchema.options;
/** Level used when the person has not taken the listening placement test. */
export const DEFAULT_GOAL_LEVEL: GoalLevel = 'b1';

export interface CatalogLesson {
  key: string;
  /** Title shown to people (Vietnamese). */
  titleVi: string;
  /** What the lesson is about, in English: the only lesson-specific text a prompt receives. */
  focusEn: string;
}

export interface CatalogGoal {
  key: string;
  titleVi: string;
  summaryVi: string;
  /** The situation, in English, for prompts. */
  situationEn: string;
  /** Levels this goal suits best (a hint, not a limit). */
  fits: readonly [GoalLevel, GoalLevel];
  lessons: readonly [
    CatalogLesson,
    CatalogLesson,
    CatalogLesson,
    CatalogLesson,
    CatalogLesson,
    CatalogLesson,
  ];
}

const lesson = (key: string, titleVi: string, focusEn: string): CatalogLesson => ({
  key,
  titleVi,
  focusEn,
});

export const GOAL_CATALOG = [
  {
    key: 'standup',
    titleVi: 'Họp stand-up hằng ngày',
    summaryVi: 'Báo việc đã làm, kế hoạch, vướng mắc và nhờ giúp trong vài câu ngắn.',
    situationEn: 'a daily stand-up meeting of a software team that works in English',
    fits: ['a2', 'b2'],
    lessons: [
      lesson('done', 'Báo việc đã làm', 'reporting what you finished yesterday'),
      lesson('plan', 'Kế hoạch hôm nay', 'saying what you will work on today'),
      lesson('blocker', 'Báo vướng mắc', 'explaining that you are blocked and why'),
      lesson('help', 'Nhờ đồng đội giúp', 'asking a teammate for help politely'),
      lesson('late', 'Báo việc bị trễ', 'telling the team that a task will be late'),
      lesson(
        'clarify',
        'Hỏi lại khi chưa nghe rõ',
        'asking someone to repeat or clarify an update',
      ),
    ],
  },
  {
    key: 'client-status',
    titleVi: 'Họp tiến độ với khách hàng',
    summaryVi: 'Mở họp, báo tiến độ và rủi ro, xin thêm thời gian, chốt việc.',
    situationEn: 'a progress meeting with an English-speaking client',
    fits: ['b1', 'c1'],
    lessons: [
      lesson('open', 'Mở đầu cuộc họp', 'opening the meeting and setting the agenda'),
      lesson('progress', 'Báo tiến độ', 'reporting progress against the plan'),
      lesson(
        'risk',
        'Báo rủi ro hoặc trễ',
        'raising a risk or a delay without alarming the client',
      ),
      lesson('more-time', 'Xin thêm thời gian', 'asking the client for more time'),
      lesson('agree', 'Chốt việc cần làm', 'confirming decisions and who does what next'),
      lesson('close', 'Kết thúc cuộc họp', 'closing the meeting and confirming the next meeting'),
    ],
  },
  {
    key: 'demo',
    titleVi: 'Demo và trình bày tính năng',
    summaryVi: 'Mở đầu, dẫn luồng, xử lý lỗi khi demo, nhận câu hỏi và góp ý.',
    situationEn: 'presenting a product demo to stakeholders',
    fits: ['b1', 'c1'],
    lessons: [
      lesson('intro', 'Mở đầu buổi demo', 'introducing the demo and what the audience will see'),
      lesson('flow', 'Dẫn người xem qua luồng', 'walking the audience through a flow step by step'),
      lesson(
        'bug',
        'Xử lý lỗi khi đang demo',
        'handling a bug or a failure during the demo calmly',
      ),
      lesson('questions', 'Nhận câu hỏi', 'taking questions and answering or deferring them'),
      lesson('feedback', 'Nhận góp ý', 'receiving feedback and acknowledging it'),
      lesson('next', 'Chốt bước tiếp theo', 'wrapping up and agreeing the next steps'),
    ],
  },
  {
    key: 'requirements',
    titleVi: 'Làm rõ yêu cầu',
    summaryVi: 'Xin nhắc lại, xác nhận đã hiểu, hỏi tiêu chí và ưu tiên, tóm tắt.',
    situationEn: 'clarifying requirements with a product owner or client',
    fits: ['a2', 'b2'],
    lessons: [
      lesson('repeat', 'Xin nhắc lại', 'asking someone to repeat or slow down'),
      lesson('confirm', 'Xác nhận mình hiểu đúng', 'checking your understanding by paraphrasing'),
      lesson('criteria', 'Hỏi tiêu chí hoàn thành', 'asking for acceptance criteria'),
      lesson('priority', 'Hỏi thứ tự ưu tiên', 'asking what matters most and what can wait'),
      lesson('assume', 'Nêu giả định', 'stating an assumption and asking if it is right'),
      lesson('sum-up', 'Tóm tắt lại', 'summarising what was agreed'),
    ],
  },
  {
    key: 'negotiation',
    titleVi: 'Đàm phán phạm vi, thời hạn, chi phí',
    summaryVi: 'Nêu ràng buộc, từ chối khéo, đề xuất phương án, nhượng bộ có điều kiện.',
    situationEn: 'negotiating scope, deadline or cost with a client or manager',
    fits: ['b2', 'c1'],
    lessons: [
      lesson('constraint', 'Nêu ràng buộc', 'stating a constraint clearly and politely'),
      lesson('decline', 'Từ chối khéo', 'declining a request while keeping the relationship'),
      lesson('options', 'Đề xuất phương án', 'proposing two or three options with trade-offs'),
      lesson('scope', 'Đổi phạm vi', 'trading scope for time or cost'),
      lesson('concede', 'Nhượng bộ có điều kiện', 'conceding something in exchange for something'),
      lesson('settle', 'Chốt thoả thuận', 'confirming the agreement and next steps'),
    ],
  },
  {
    key: 'interview',
    titleVi: 'Phỏng vấn xin việc kỹ thuật',
    summaryVi: 'Giới thiệu bản thân, kể dự án, giải thích kỹ thuật, trả lời câu hỏi hành vi.',
    situationEn: 'a technical job interview with an English-speaking interviewer',
    fits: ['b1', 'c1'],
    lessons: [
      lesson('intro', 'Giới thiệu bản thân', 'introducing yourself and your background'),
      lesson('project', 'Kể về một dự án', 'describing a project you worked on and your role'),
      lesson('explain', 'Giải thích một vấn đề kỹ thuật', 'explaining a technical decision simply'),
      lesson(
        'behaviour',
        'Trả lời câu hỏi hành vi',
        'answering a behavioural question with a short story',
      ),
      lesson('ask-back', 'Hỏi lại nhà tuyển dụng', 'asking the interviewer good questions'),
      lesson(
        'wrap',
        'Kết thúc buổi phỏng vấn',
        'closing the interview and thanking the interviewer',
      ),
    ],
  },
  {
    key: 'small-talk',
    titleVi: 'Small talk đầu và cuối cuộc họp',
    summaryVi: 'Chào hỏi, nói chuyện thời tiết hay cuối tuần, hỏi thăm, chuyển sang việc.',
    situationEn: 'small talk before and after a meeting with colleagues or clients',
    fits: ['a2', 'b2'],
    lessons: [
      lesson('greet', 'Chào hỏi', 'greeting people and asking how they are'),
      lesson('weekend', 'Thời tiết và cuối tuần', 'chatting about the weather and the weekend'),
      lesson('ask', 'Hỏi thăm', 'asking friendly questions about someone’s work or trip'),
      lesson('compliment', 'Khen ngợi', 'giving and accepting a compliment'),
      lesson('switch', 'Chuyển sang việc chính', 'moving from small talk to the agenda'),
      lesson('goodbye', 'Chào kết', 'saying goodbye and making a friendly closing remark'),
    ],
  },
  {
    key: 'onsite',
    titleVi: 'Làm việc onsite tại văn phòng khách',
    summaryVi: 'Làm quen nhóm, hỏi quy trình, ăn trưa cùng, nhờ hỗ trợ, họp trực tiếp.',
    situationEn: 'working onsite at a client’s office for the first time',
    fits: ['a2', 'b2'],
    lessons: [
      lesson('meet', 'Làm quen với nhóm', 'meeting the team on the first day'),
      lesson('where', 'Hỏi chỗ và quy trình', 'asking where things are and how things work'),
      lesson('lunch', 'Ăn trưa cùng đồng nghiệp', 'having lunch and chatting with colleagues'),
      lesson('support', 'Nhờ hỗ trợ', 'asking for IT or office support'),
      lesson('in-person', 'Họp trực tiếp', 'taking part in an in-person meeting'),
      lesson('leave', 'Tạm biệt khi kết thúc', 'saying goodbye at the end of the visit'),
    ],
  },
] as const satisfies readonly CatalogGoal[];

export type GoalKey = (typeof GOAL_CATALOG)[number]['key'];
export const GOAL_KEYS = GOAL_CATALOG.map((goal) => goal.key) as [GoalKey, ...GoalKey[]];
export const GoalKeySchema = z.enum(GOAL_KEYS);

export function findCatalogGoal(key: string): CatalogGoal | undefined {
  return (GOAL_CATALOG as readonly CatalogGoal[]).find((goal) => goal.key === key);
}

/** The lesson of a goal, or undefined when the goal or the lesson is not in the catalog. */
export function findCatalogLesson(goalKey: string, lessonKey: string): CatalogLesson | undefined {
  return findCatalogGoal(goalKey)?.lessons.find((item) => item.key === lessonKey);
}

/** Lesson keys are unique inside a goal, not across goals; this is the pair the API takes. */
export const LessonKeySchema = z.string().regex(/^[a-z][a-z0-9-]{1,23}$/);
