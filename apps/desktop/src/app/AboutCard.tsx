import { Kbd } from '@cuelingo/ui/components/kbd';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { Logo } from '@cuelingo/ui/components/logo';
import { shortcutLabel } from '../lib/platform';
import { UpdateSection } from '../updater';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from './brand';

const shortcuts = [
  { key: 'L', label: 'Hiện hoặc ẩn overlay caption' },
  { key: 'W', label: 'Họ vừa nói gì? (tóm tắt)' },
  { key: 'S', label: 'Nói giúp (soạn câu tiếng Anh)' },
  { key: 'Y', label: 'Hỏi trợ lý trong cuộc họp (khi máy chủ có bật)' },
] as const;

export function ShortcutList() {
  return (
    <ul className="space-y-2 text-sm">
      {shortcuts.map((shortcut) => (
        <li key={shortcut.key} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{shortcut.label}</span>
          <Kbd>{shortcutLabel(shortcut.key)}</Kbd>
        </li>
      ))}
    </ul>
  );
}

export function AboutCard() {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-4">
        <Logo size={52} />
        <div>
          <CardTitle>
            {APP_NAME}{' '}
            <span className="text-muted-foreground text-sm font-normal">v{APP_VERSION}</span>
          </CardTitle>
          <CardDescription>{APP_TAGLINE}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-2 text-sm">
        <UpdateSection version={APP_VERSION} />
        <p>
          Caption kèm bản dịch tiếng Việt cho cuộc họp tiếng Anh, Nhật, Hàn và Trung; cuộc họp tiếng
          Việt có transcript. Tiếng Anh được nhận dạng ngay trên máy, chỉ văn bản được gửi đi dịch.
          Các ngôn ngữ còn lại nhận dạng bằng đám mây (âm thanh gửi tới Google) và chỉ khi bạn đồng
          ý.
        </p>
        <p>© 2026 CMC AI</p>
      </CardContent>
    </Card>
  );
}
