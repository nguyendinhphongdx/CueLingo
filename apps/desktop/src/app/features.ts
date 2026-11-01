import {
  BookOpenCheck,
  Bookmark,
  History,
  Languages,
  Mic,
  Settings,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

/**
 * The product roadmap as the app shows it. Flip `status` to `ready` and add the view when a feature ships.
 * `web` means it already works on the web app and the desktop page links to it.
 */
export type FeatureStatus = 'ready' | 'web' | 'soon';

export type View =
  'home' | 'meetings' | 'review' | 'phrases' | 'glossary' | 'progress' | 'settings';

export interface Feature {
  view: View;
  label: string;
  group: 'meeting' | 'learn' | 'app';
  icon: LucideIcon;
  status: FeatureStatus;
  /** One sentence on what the person gets. */
  summary: string;
  /** Concrete things they will be able to do. */
  bullets: string[];
  /** Path on the web app, when there is one. */
  webPath?: string;
}

export const features: Feature[] = [
  {
    view: 'home',
    label: 'Phiên họp',
    group: 'meeting',
    icon: Mic,
    status: 'ready',
    summary: 'Bật caption song ngữ cho cuộc họp đang diễn ra.',
    bullets: [],
  },
  {
    view: 'meetings',
    label: 'Cuộc họp',
    group: 'meeting',
    icon: History,
    status: 'ready',
    summary: 'Xem lại các cuộc họp và debrief sau họp.',
    bullets: [],
    webPath: '/sessions',
  },
  {
    view: 'review',
    label: 'Ôn tập',
    group: 'learn',
    icon: BookOpenCheck,
    status: 'soon',
    summary: 'Ôn lại cụm từ từ chính các cuộc họp của bạn, 5–10 phút mỗi ngày.',
    bullets: [
      'Thẻ nhận diện nghĩa và điền chỗ trống từ câu trong cuộc họp',
      'Lịch ôn tự giãn dần theo trí nhớ của bạn (FSRS)',
      'Bài nghe–gõ với giọng đọc tiếng Anh',
    ],
    webPath: '/review',
  },
  {
    view: 'phrases',
    label: 'Cụm từ',
    group: 'learn',
    icon: Bookmark,
    status: 'soon',
    summary: 'Kho cụm từ bạn đã lưu từ debrief và từ lúc tra từ.',
    bullets: [
      'Lưu cụm từ chỉ với một cú bấm từ caption hoặc debrief',
      'Xem câu gốc trong cuộc họp nơi cụm từ xuất hiện',
      'Bỏ cụm từ khỏi lịch ôn khi bạn đã thuộc',
    ],
    webPath: '/phrases',
  },
  {
    view: 'glossary',
    label: 'Thuật ngữ',
    group: 'learn',
    icon: Languages,
    status: 'soon',
    summary: 'Thuật ngữ riêng của công việc, để caption nghe và dịch đúng.',
    bullets: [
      'Thêm từ viết tắt và tên sản phẩm như SLA, roadmap',
      'Nhận dạng giọng nói sửa đúng các từ này',
      'Chọn bộ thuật ngữ trước mỗi cuộc họp',
    ],
    webPath: '/glossary',
  },
  {
    view: 'progress',
    label: 'Tiến độ',
    group: 'learn',
    icon: TrendingUp,
    status: 'soon',
    summary: 'Bạn nghe hiểu tốt hơn bao nhiêu qua từng tuần.',
    bullets: [
      'Phần trăm hiểu trung bình của các cuộc họp',
      'Số lần phải tra từ mỗi cuộc họp, theo tuần',
      'Chuỗi ngày ôn tập liên tiếp',
    ],
    webPath: '/progress',
  },
  {
    view: 'settings',
    label: 'Cài đặt',
    group: 'app',
    icon: Settings,
    status: 'ready',
    summary: 'Quyền truy cập, tài khoản và thông tin ứng dụng.',
    bullets: [],
  },
];

export const featureGroups: Array<{ id: Feature['group']; title: string }> = [
  { id: 'meeting', title: 'Họp' },
  { id: 'learn', title: 'Học' },
  { id: 'app', title: 'Ứng dụng' },
];

/** Features that are not in the app yet, shown as a short roadmap in Settings. */
export const upcoming: Array<{ title: string; description: string }> = [
  {
    title: 'Tài khoản',
    description: 'Đăng nhập trong app để đồng bộ cuộc họp và cụm từ giữa máy và web.',
  },
  {
    title: 'Nhãn người nói',
    description: 'Phân biệt "Tôi" và từng người trong cuộc họp ngay trên caption.',
  },
  {
    title: 'Nghe lại đoạn khó',
    description: 'Phát lại đoạn bạn khó nghe ở tốc độ 0,75× và ẩn hiện chữ.',
  },
  { title: 'Mức hỗ trợ tự điều chỉnh', description: 'Gợi ý giảm hỗ trợ khi bạn đã nghe tốt hơn.' },
  {
    title: 'Bài nghe đánh giá đầu vào',
    description: '5 phút để chọn mức hỗ trợ phù hợp ngay từ đầu.',
  },
  { title: 'Xoá dữ liệu', description: 'Xoá cuộc họp và cụm từ của bạn bất cứ lúc nào.' },
];
