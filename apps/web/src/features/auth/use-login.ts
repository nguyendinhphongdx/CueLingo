import { useMutation } from '@tanstack/react-query';
import { authClient } from '../../lib/auth-client';

const redirectTarget = () => `${window.location.origin}/glossary`;

/** Sign-in actions for the login screen. UI components never touch authClient directly. */
export function useLogin() {
  const magicLink = useMutation({
    mutationFn: async (email: string) => {
      const result = await authClient.signIn.magicLink({ email, callbackURL: redirectTarget() });
      if (result.error) throw new Error('Không gửi được liên kết đăng nhập, vui lòng thử lại');
    },
  });

  const google = useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: redirectTarget(),
      });
      if (result.error) throw new Error('Không đăng nhập được bằng Google, vui lòng thử lại');
    },
  });

  return {
    sendLink: magicLink.mutate,
    sending: magicLink.isPending,
    sent: magicLink.isSuccess,
    signInWithGoogle: google.mutate,
    error: magicLink.error?.message ?? google.error?.message ?? null,
  };
}
