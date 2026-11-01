import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { useAssistSettings } from './use-assist-settings';

const options = [
  { level: 4, label: 'Đầy đủ' },
  { level: 3, label: 'Gợi ý' },
  { level: 1, label: 'Tối thiểu' },
] as const;

export function AssistSettings() {
  const { assistLevel, setAssistLevel, saving, error } = useAssistSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mức hỗ trợ</CardTitle>
        <CardDescription>Chọn lượng thông tin bạn muốn thấy trong caption.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2" aria-label="Mức hỗ trợ">
          {options.map((option) => (
            <Button
              key={option.level}
              variant={assistLevel === option.level ? 'default' : 'outline'}
              aria-pressed={assistLevel === option.level}
              disabled={saving}
              onClick={() => setAssistLevel(option.level)}
            >
              {option.level} · {option.label}
            </Button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
