import { Kbd } from '@cuelingo/ui/components/kbd';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { APP_NAME, APP_TAGLINE, APP_VERSION, Logo } from './Logo';

const shortcuts = [
  { keys: '⌘⇧L', label: 'Hiện hoặc ẩn overlay caption' },
  { keys: '⌘⇧W', label: 'Họ vừa nói gì? (tóm tắt)' },
  { keys: '⌘⇧S', label: 'Nói giúp (soạn câu tiếng Anh)' },
];

export function ShortcutList() {
  return (
    <ul className="space-y-2 text-sm">
      {shortcuts.map((shortcut) => (
        <li key={shortcut.keys} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{shortcut.label}</span>
          <Kbd>{shortcut.keys}</Kbd>
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
        <p>
          Caption tiếng Anh kèm bản dịch tiếng Việt cho mọi cuộc họp trên máy bạn. Âm thanh được
          nhận dạng ngay trên máy, chỉ văn bản được gửi đi dịch.
        </p>
        <p>© 2026 CMC AI</p>
      </CardContent>
    </Card>
  );
}
