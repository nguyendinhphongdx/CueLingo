import { Button } from '@cuelingo/ui/components/button';
import { Logo } from '@cuelingo/ui/components/logo';
import { Loader2 } from 'lucide-react';
import type { SignInPhase } from './use-auth';

const messages: Record<SignInPhase, string> = {
  idle: 'Đăng nhập bằng email để lưu cuộc họp, cụm từ và tiến độ của bạn trên mọi thiết bị.',
  waiting: 'Hoàn tất đăng nhập trên trình duyệt, rồi quay lại đây. CueLingo sẽ tự mở.',
  exchanging: 'Đang hoàn tất đăng nhập…',
  failed: 'Không đăng nhập được. Mã có thể đã hết hạn, hãy thử lại.',
};

/** Shown instead of the app until someone is signed in. */
export function LoginScreen({ phase, onSignIn }: { phase: SignInPhase; onSignIn(): void }) {
  const busy = phase === 'exchanging';
  return (
    <main className="bg-background text-foreground flex h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <Logo size={56} className="mx-auto rounded-[22%]" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Chào mừng đến CueLingo</h1>
        <p
          role={phase === 'failed' ? 'alert' : undefined}
          aria-live="polite"
          className={`mt-2 text-sm leading-relaxed ${
            phase === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
          }`}
        >
          {messages[phase]}
        </p>
        <Button size="lg" className="mt-6 w-full cursor-pointer" disabled={busy} onClick={onSignIn}>
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {phase === 'waiting' ? 'Mở lại trang đăng nhập' : 'Đăng nhập bằng email'}
        </Button>
      </div>
    </main>
  );
}
