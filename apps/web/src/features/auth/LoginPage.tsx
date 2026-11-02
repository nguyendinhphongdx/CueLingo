'use client';

import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { Input } from '@cuelingo/ui/components/input';
import { Logo } from '@cuelingo/ui/components/logo';
import { useState, type FormEvent } from 'react';
import { GOOGLE_ENABLED, IS_DEV } from '../../lib/config';
import { GoogleIcon } from './GoogleIcon';
import { useLogin } from './use-login';

/** Passwordless sign-in: a magic link by email, plus Google when it is configured (US-01). */
export function LoginPage() {
  const { sendLink, sending, sent, signInWithGoogle, googleWaiting, error } = useLogin();
  const [email, setEmail] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) sendLink(email.trim());
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Logo size={40} className="rounded-[22%]" />
          <span className="text-lg font-semibold tracking-tight">CueLingo</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Đăng nhập CueLingo</CardTitle>
            <CardDescription>
              Nhập email để nhận liên kết đăng nhập, không cần mật khẩu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={onSubmit} className="space-y-3">
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="ban@congty.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email"
              />
              <Button type="submit" className="min-h-11 w-full" disabled={sending}>
                {sending ? 'Đang gửi…' : 'Gửi liên kết đăng nhập'}
              </Button>
            </form>

            {sent && (
              <p role="status" className="text-sm">
                Đã gửi liên kết tới <strong>{email}</strong>. Mở email và bấm vào liên kết để vào
                ứng dụng.
                {IS_DEV && (
                  <span className="text-muted-foreground block pt-1">
                    (Môi trường dev: liên kết được in trong log của API, không gửi email thật.)
                  </span>
                )}
              </p>
            )}
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}

            {GOOGLE_ENABLED && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full gap-2.5"
                disabled={googleWaiting}
                onClick={() => signInWithGoogle()}
              >
                <GoogleIcon />
                {googleWaiting ? 'Đang chờ cửa sổ Google…' : 'Tiếp tục với Google'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
