import { spring } from '@animate-ui/react/utils/motion';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useColorScheme } from './use-color-scheme';
import {
  clearOnboarding,
  completeOnboarding,
  type OnboardingMode,
  OnboardingFlow,
  PermissionsStep,
  shouldShowOnboarding,
} from '../onboarding';
import { FeedbackPage } from '../feedback';
import { UpdateBanner } from '../updater';
import { PrivacyPanel } from '../privacy';
import { useActivationTelemetry } from '../telemetry';
import { RecentSessions, SessionPanel } from '../session';
import { PlacementSection } from '../study';
import { CalendarHintCard, CalendarSettings } from '../calendar';
import {
  AssistSettings,
  AssistSuggestionBanner,
  useLearnLanguage,
  useSettingsSync,
} from '../settings';
import { useSyncAssistLevel } from '../settings/use-assist-settings';
import { AboutCard, ShortcutList } from './AboutCard';
import { Button } from '@cuelingo/ui/components/button';
import { ComingSoon } from '@cuelingo/ui/components/coming-soon';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { ListCard, Section } from '@cuelingo/ui/components/section';
import { SoonBadge } from '@cuelingo/ui/components/soon-badge';
import { features, upcoming } from '@cuelingo/ui/lib/roadmap';
import { ExternalLink } from 'lucide-react';
import { AccountCard, isDevToken, LoginScreen, useAuth, useMe } from '../auth';
import { AppShell } from './AppShell';
import { views } from './views';
import { openWeb } from './open-web';

export function App() {
  useColorScheme();
  const auth = useAuth();
  const account = useMe();
  useSettingsSync();
  useSyncAssistLevel();
  useActivationTelemetry(account.me?.id ?? null);
  const [view, setView] = useState('home');
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>('auto');

  const userId = account.me?.id ?? 'dev';
  useEffect(() => setOnboardingMode('auto'), [userId]);

  if (auth.status === 'loading') return <div className="bg-background h-screen" />;
  // A development token in the environment lets the app run without an account.
  if (auth.status === 'signedOut' && !isDevToken()) {
    return <LoginScreen phase={auth.phase} onSignIn={() => void auth.signIn()} />;
  }
  if (auth.status === 'signedIn' && account.loading)
    return <div className="bg-background h-screen" />;

  const showOnboarding = shouldShowOnboarding(onboardingMode, userId);
  if (showOnboarding) {
    return (
      <OnboardingFlow
        onFinish={() => {
          completeOnboarding(userId);
          setOnboardingMode('complete');
        }}
      />
    );
  }

  const reviewOnboarding = () => {
    clearOnboarding(userId);
    setOnboardingMode('open');
  };

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
            <CurrentView
              view={view}
              onSignOut={() => void auth.signOut()}
              onReviewOnboarding={reviewOnboarding}
            />
          </motion.div>
        </AnimatePresence>
      </AppShell>
    </MotionConfig>
  );
}

function CurrentView({
  view,
  onSignOut,
  onReviewOnboarding,
}: {
  view: string;
  onSignOut(): void;
  onReviewOnboarding(): void;
}) {
  const feature = features.find((item) => item.id === view)!;
  const { language, setLanguage, options } = useLearnLanguage();
  const Page = views[view];
  if (Page) {
    return (
      <>
        <PageHeader
          title={feature.label}
          action={<LanguageSwitcher options={options} value={language} onChange={setLanguage} />}
        />
        <Page />
      </>
    );
  }

  if (view === 'home') {
    return (
      <>
        <PageHeader title="Phiên họp" />
        <UpdateBanner />
        <AssistSuggestionBanner />
        <CalendarHintCard />
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
  if (view === 'feedback') return <FeedbackPage />;
  if (view === 'settings') {
    return (
      <>
        <PageHeader title="Cài đặt" />
        <AccountCard onSignOut={onSignOut} />
        <PermissionsStep />
        <CalendarSettings />
        <PlacementSection />
        <Section title="Hướng dẫn">
          <div className="bg-card flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Làm quen với CueLingo</p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                Xem lại bốn bước về quyền, caption và mức hỗ trợ.
              </p>
            </div>
            <Button variant="outline" className="shrink-0" onClick={onReviewOnboarding}>
              Xem lại hướng dẫn
            </Button>
          </div>
        </Section>
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
