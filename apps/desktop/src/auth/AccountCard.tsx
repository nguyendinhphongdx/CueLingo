import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { isDevToken, useAuthStore } from './auth-store';

/** Settings card: who is signed in on this device, and how to sign out. */
export function AccountCard({ onSignOut }: { onSignOut(): void }) {
  const token = useAuthStore((state) => state.token);
  const dev = isDevToken();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tài khoản</CardTitle>
        <CardDescription>
          {dev
            ? 'Đang chạy ở chế độ phát triển với token dev, chưa đăng nhập bằng tài khoản.'
            : 'Thiết bị này đã đăng nhập. Cuộc họp và cụm từ được đồng bộ với web.'}
        </CardDescription>
      </CardHeader>
      {token ? (
        <CardContent>
          <Button variant="outline" className="cursor-pointer" onClick={onSignOut}>
            Đăng xuất khỏi thiết bị này
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}
