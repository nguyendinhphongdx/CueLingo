/**
 * The product roadmap as every client shows it: one list drives the sidebar, the coming-soon pages
 * and the roadmap card. Flip `status` to `ready` (or `web`) when a feature ships in that client.
 */
export type FeatureStatus = 'ready' | 'soon';
export type FeatureGroup = 'meeting' | 'learn' | 'app';
export type FeatureIconName =
  | 'mic'
  | 'history'
  | 'review'
  | 'bookmark'
  | 'languages'
  | 'progress'
  | 'settings'
  | 'feedback'
  | 'assistant'
  | 'upgrade';

export interface Feature {
  id: string;
  label: string;
  group: FeatureGroup;
  icon: FeatureIconName;
  /** Per client: where the feature stands in that client. */
  status: { desktop: FeatureStatus; web: FeatureStatus };
  summary: string;
  bullets: string[];
  /** Route on the web app. */
  webPath: string;
}

export const features: Feature[] = [
  {
    id: 'home',
    label: 'Phiên họp',
    group: 'meeting',
    icon: 'mic',
    status: { desktop: 'ready', web: 'soon' },
    summary: 'Bật caption song ngữ cho cuộc họp đang diễn ra.',
    bullets: [
      'Caption kèm bản dịch tiếng Việt ngay trên màn hình',
      'Tra từ, tóm tắt và soạn câu trả lời trong lúc họp',
    ],
    webPath: '/live',
  },
  {
    id: 'meetings',
    label: 'Cuộc họp',
    group: 'meeting',
    icon: 'history',
    status: { desktop: 'ready', web: 'ready' },
    summary: 'Xem lại các cuộc họp và debrief sau họp.',
    bullets: ['Tóm tắt, việc cần làm, đoạn khó và cụm từ nên lưu', 'Xuất debrief ra Markdown'],
    webPath: '/sessions',
  },
  {
    id: 'glossary',
    label: 'Thuật ngữ',
    group: 'meeting',
    icon: 'languages',
    status: { desktop: 'ready', web: 'ready' },
    summary: 'Thuật ngữ riêng của công việc, để caption nghe và dịch đúng.',
    bullets: [
      'Thêm từ viết tắt và tên sản phẩm như SLA, roadmap',
      'Nhận dạng giọng nói sửa đúng các từ này',
      'Chọn bộ thuật ngữ trước mỗi cuộc họp',
    ],
    webPath: '/glossary',
  },
  {
    id: 'review',
    label: 'Ôn tập',
    group: 'learn',
    icon: 'review',
    status: { desktop: 'ready', web: 'ready' },
    summary: 'Ôn lại cụm từ từ chính các cuộc họp của bạn, 5–10 phút mỗi ngày.',
    bullets: [
      'Hôm nay: thẻ nhận diện nghĩa và điền chỗ trống từ câu trong cuộc họp, lịch ôn tự giãn dần (FSRS)',
      'Kho cụm từ: các cụm bạn đã lưu từ debrief và lúc tra từ, kèm câu gốc trong cuộc họp',
      'Tiến độ: phần trăm hiểu theo tuần, số lần phải tra từ, chuỗi ngày ôn liên tiếp',
      'Lộ trình: mỗi cuộc họp có debrief thành một khoá 3–10 bài từ chính cụm từ của cuộc họp, kèm tỷ lệ hoàn thành',
      'Mục tiêu: chọn một trong 8 mục tiêu (stand-up, demo, đàm phán, phỏng vấn…) để có 6 bài AI soạn, mỗi bài có tình huống, hội thoại có audio, luyện câu và kiểm tra',
    ],
    webPath: '/review',
  },
  {
    id: 'assistant',
    label: 'Trợ lý AI',
    group: 'learn',
    icon: 'assistant',
    status: { desktop: 'soon', web: 'ready' },
    summary: 'Hỏi trợ lý về tiếng Anh công sở và chuẩn bị cho cuộc họp (thử nghiệm).',
    bullets: [
      'Giải thích từ, câu và cách diễn đạt, có ví dụ',
      'Nhấp đúp vào một từ để tra nghĩa, nghe và lưu vào Cụm từ',
      'Tạo thẻ ghi nhớ, điền chỗ trống và câu hỏi trắc nghiệm ngay trong cuộc trò chuyện',
    ],
    webPath: '/assistant',
  },
  {
    id: 'settings',
    label: 'Cài đặt',
    group: 'app',
    icon: 'settings',
    status: { desktop: 'ready', web: 'soon' },
    summary: 'Tài khoản, quyền riêng tư và thông tin ứng dụng.',
    bullets: ['Quản lý tài khoản và thiết bị', 'Xoá dữ liệu cuộc họp và cụm từ của bạn'],
    webPath: '/settings',
  },
  {
    id: 'feedback',
    label: 'Góp ý',
    group: 'app',
    icon: 'feedback',
    status: { desktop: 'ready', web: 'ready' },
    summary: 'Báo lỗi hoặc góp ý cho đội CueLingo.',
    bullets: ['Chỉ gửi nội dung bạn gõ cùng phiên bản app', 'Không kèm transcript hay âm thanh'],
    webPath: '/feedback',
  },
  {
    id: 'upgrade',
    label: 'Nâng cấp',
    group: 'app',
    icon: 'upgrade',
    // Plans are sold on the web only; the desktop entry opens that page in the browser.
    status: { desktop: 'ready', web: 'ready' },
    summary: 'Xem các gói và nâng cấp để dùng nhiều hơn.',
    bullets: ['So sánh gói và hạn mức', 'Thanh toán trên web, áp dụng ngay cho cả app và web'],
    webPath: '/upgrade',
  },
];

/** The tabs of the Ôn tập page. Clients draw the tabs from this list so web and desktop never disagree. */
export const REVIEW_TABS = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'phrases', label: 'Kho cụm từ' },
  { id: 'progress', label: 'Tiến độ' },
  { id: 'path', label: 'Lộ trình' },
] as const;
export type ReviewTabId = (typeof REVIEW_TABS)[number]['id'];

export const DEFAULT_REVIEW_TAB: ReviewTabId = 'today';

/** Reads a tab id from a query string value (`/review?tab=phrases`); anything unknown is the default tab. */
export function parseReviewTab(value: string | null | undefined): ReviewTabId {
  return REVIEW_TABS.find((tab) => tab.id === value)?.id ?? DEFAULT_REVIEW_TAB;
}

/**
 * Old view ids that now live inside the Ôn tập page: `phrases` and `progress` were features of their own
 * before the three tabs were merged. Returns the tab to open, or `null` for any other id.
 */
export function reviewTabForView(viewId: string): ReviewTabId | null {
  if (viewId === 'review') return DEFAULT_REVIEW_TAB;
  return viewId === 'phrases' || viewId === 'progress' ? viewId : null;
}

/** Maps a view id from before the merge to the roadmap feature that holds it now (`phrases` → `review`). */
export function currentFeatureId(viewId: string): string {
  return reviewTabForView(viewId) ? 'review' : viewId;
}

export const featureGroups: Array<{ id: FeatureGroup; title: string }> = [
  { id: 'meeting', title: 'Họp' },
  { id: 'learn', title: 'Học' },
  { id: 'app', title: 'Ứng dụng' },
];

/** Smaller items on the roadmap that have no page of their own yet. */
export const upcoming: Array<{ title: string; description: string }> = [
  {
    title: 'Nhãn người nói',
    description: 'Phân biệt "Tôi" và từng người trong cuộc họp ngay trên caption.',
  },
  {
    title: 'Nghe lại đoạn khó',
    description: 'Phát lại đoạn bạn khó nghe ở tốc độ 0,75× và ẩn hiện chữ.',
  },
];
