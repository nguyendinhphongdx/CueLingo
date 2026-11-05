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
  | 'assistant';

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
    id: 'review',
    label: 'Ôn tập',
    group: 'learn',
    icon: 'review',
    status: { desktop: 'ready', web: 'ready' },
    summary: 'Ôn lại cụm từ từ chính các cuộc họp của bạn, 5–10 phút mỗi ngày.',
    bullets: [
      'Thẻ nhận diện nghĩa và điền chỗ trống từ câu trong cuộc họp',
      'Lịch ôn tự giãn dần theo trí nhớ của bạn (FSRS)',
      'Bài nghe–gõ với giọng đọc tiếng Anh',
    ],
    webPath: '/review',
  },
  {
    id: 'assistant',
    label: 'Trợ lý AI',
    group: 'learn',
    icon: 'assistant',
    status: { desktop: 'soon', web: 'soon' },
    summary: 'Hỏi trợ lý về tiếng Anh công sở và chuẩn bị cho cuộc họp (thử nghiệm).',
    bullets: [
      'Giải thích từ, câu và cách diễn đạt, có ví dụ',
      'Nhấp đúp vào một từ để tra nghĩa, nghe và lưu vào Cụm từ',
      'Tạo thẻ ghi nhớ, điền chỗ trống và câu hỏi trắc nghiệm ngay trong cuộc trò chuyện',
    ],
    webPath: '/assistant',
  },
  {
    id: 'phrases',
    label: 'Cụm từ',
    group: 'learn',
    icon: 'bookmark',
    status: { desktop: 'ready', web: 'ready' },
    summary: 'Kho cụm từ bạn đã lưu từ debrief và từ lúc tra từ.',
    bullets: [
      'Lưu cụm từ chỉ với một cú bấm từ caption hoặc debrief',
      'Xem câu gốc trong cuộc họp nơi cụm từ xuất hiện',
      'Bỏ cụm từ khỏi lịch ôn khi bạn đã thuộc',
    ],
    webPath: '/phrases',
  },
  {
    id: 'glossary',
    label: 'Thuật ngữ',
    group: 'learn',
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
    id: 'progress',
    label: 'Tiến độ',
    group: 'learn',
    icon: 'progress',
    status: { desktop: 'ready', web: 'ready' },
    summary: 'Bạn nghe hiểu tốt hơn bao nhiêu qua từng tuần.',
    bullets: [
      'Phần trăm hiểu trung bình của các cuộc họp',
      'Số lần phải tra từ mỗi cuộc họp, theo tuần',
      'Chuỗi ngày ôn tập liên tiếp',
    ],
    webPath: '/progress',
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
];

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
