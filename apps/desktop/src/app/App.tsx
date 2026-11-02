import { spring } from '@animate-ui/react/utils/motion';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useState } from 'react';
import { useColorScheme } from './use-color-scheme';
import { PermissionsStep } from '../onboarding';
import { PrivacyPanel } from '../privacy';
import { RecentSessions, SessionPanel } from '../session';
import { AssistSettings } from '../settings';
import { useSyncAssistLevel } from '../settings/use-assist-settings';
import { AboutCard, ShortcutList } from './AboutCard';
import { Button } from '@cuelingo/ui/components/button';
import { ComingSoon } from '@cuelingo/ui/components/coming-soon';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { ListCard, Section } from '@cuelingo/ui/components/section';
import { SoonBadge } from '@cuelingo/ui/components/soon-badge';
import { features, upcoming } from '@cuelingo/ui/lib/roadmap';
import { ExternalLink } from 'lucide-react';
import { AccountCard, isDevToken, LoginScreen, useAuth } from '../auth';
import { AppShell } from './AppShell';
import { views } from './views';
import { openWeb } from './open-web';

export function App() {
  useColorScheme();
  const auth = useAuth();
  useSyncAssistLevel();
  const [view, setView] = useState('home');

  if (auth.status === 'loading') return <div className="bg-background h-screen" />;
  // A development token in the environment lets the app run without an account.
  if (auth.status === 'signedOut' && !isDevToken()) {
    return <LoginScreen phase={auth.phase} onSignIn={() => void auth.signIn()} />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <AppShell view={view} onNavigate={setView} onSignOut={() => void auth.signOut()}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: spring.pop }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <CurrentView view={view} onSignOut={() => void auth.signOut()} />
          </motion.div>
        </AnimatePresence>
      </AppShell>
    </MotionConfig>
  );
}

function CurrentView({ view, onSignOut }: { view: string; onSignOut(): void }) {
  const feature = features.find((item) => item.id === view)!;
  const Page = views[view];
  if (Page) {
    return (
      <>
        <PageHeader title={feature.label} />
        <Page />
      </>
    );
  }

  if (view === 'home') {
    return (
      <>
        <PageHeader title="Phiên họp" />
        <SessionPanel />
        <AssistSettings />
        <RecentSessions />
        <Section title="Phím tắt">
          <div className="bg-card rounded-xl border px-4 py-3">
            <ShortcutList />
          </div>
        </Section>
      </>
    );
  }
  if (view === 'meetings') {
    return (
      <>
        <PageHeader title="Cuộc họp" description="Bấm vào một cuộc họp để mở debrief trên web." />
        <RecentSessions limit={20} showEmpty />
      </>
    );
  }
  if (view === 'settings') {
    return (
      <>
        <PageHeader title="Cài đặt" />
        <AccountCard onSignOut={onSignOut} />
        <PermissionsStep />
        <PrivacyPanel />
        <AboutCard />
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
  return (
    <>
      <PageHeader title={feature.label} />
      <ComingSoon
        feature={feature}
        action={
          <>
            <p className="text-muted-foreground mb-3 text-sm">
              Trong lúc chờ bản trong app, bạn dùng được ngay trên web.
            </p>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => void openWeb(feature.webPath)}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
              Mở trên web
            </Button>
          </>
        }
      />
    </>
  );
}
