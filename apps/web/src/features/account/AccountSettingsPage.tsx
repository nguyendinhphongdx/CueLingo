'use client';

import { Button } from '@cuelingo/ui/components/button';
import { ComingSoon } from '@cuelingo/ui/components/coming-soon';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { ListCard, Section } from '@cuelingo/ui/components/section';
import { SoonBadge } from '@cuelingo/ui/components/soon-badge';
import { features, upcoming } from '@cuelingo/ui/lib/roadmap';
import { useRouter } from 'next/navigation';
import { authClient } from '../../lib/auth-client';

const settingsFeature = features.find((feature) => feature.id === 'settings')!;

export function AccountSettingsView({
  email,
  onSignOut,
}: {
  email?: string;
  onSignOut: () => void;
}) {
  return (
    <>
      <PageHeader title="Cài đặt" />
      <Section title="Tài khoản">
        <div className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Email đăng nhập</p>
            <p className="truncate text-sm font-medium">{email}</p>
          </div>
          <Button
            variant="outline"
            className="min-h-11 shrink-0 cursor-pointer"
            onClick={onSignOut}
          >
            Đăng xuất
          </Button>
        </div>
      </Section>
      <ComingSoon feature={settingsFeature} />
      <Section title="Đang trên lộ trình">
        <ListCard>
          {upcoming.map((item) => (
            <li key={item.title} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">{item.description}</p>
              </div>
              <SoonBadge />
            </li>
          ))}
        </ListCard>
      </Section>
    </>
  );
}

export function AccountSettingsPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const signOut = async () => {
    await authClient.signOut();
    router.replace('/login');
  };

  return <AccountSettingsView email={session?.user.email} onSignOut={() => void signOut()} />;
}
