import { spring } from '@animate-ui/react/utils/motion';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useColorScheme } from './use-color-scheme';
import {
  clearOnboarding,
  completeOnboarding,
  type OnboardingMode,
  OnboardingFlow,
  shouldShowOnboarding,
} from '../onboarding';
import { FeedbackPage } from '../feedback';
import { ServerLink } from '../server-picker';
import { useActivationTelemetry } from '../telemetry';
import { MeetingsPage } from '../session';
import { useLearnLanguage, useSettingsSync } from '../settings';
import { useSyncAssistLevel } from '../settings/use-assist-settings';
import { Button } from '@cuelingo/ui/components/button';
import { ComingSoon } from '@cuelingo/ui/components/coming-soon';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { features } from '@cuelingo/ui/lib/roadmap';
import { ExternalLink } from 'lucide-react';
import { isDevToken, LoginScreen, useAuth, useMe } from '../auth';
import { AppShell } from './AppShell';
import { HomePage } from './HomePage';
import { tabForView } from './ReviewTabs';
import { SettingsPage } from './SettingsPage';
import { views } from './views';
import { openWeb } from './open-web';
import { useOpenSettingsRequests } from './use-open-settings';
import { UPGRADE_PATH } from '../usage/upgrade';

export function App() {
  useColorScheme();
  const auth = useAuth();
  const account = useMe();
  useSettingsSync();
  useSyncAssistLevel();
  useActivationTelemetry(account.me?.id ?? null);
  const [view, setView] = useState('home');
  useOpenSettingsRequests(() => setView('settings'));
  // Hôm nay, Kho cụm từ and Tiến độ are tabs of one view; the old ids open the matching tab.
  const [reviewTab, setReviewTab] = useState('today');
  const navigate = (id: string) => {
    // Plans are sold on the web: Nâng cấp opens that page in the browser and leaves the current view.
    if (id === 'upgrade') {
      void openWeb(UPGRADE_PATH);
      return;
    }
    const tab = tabForView(id);
    if (tab) {
      setReviewTab(tab);
      setView('review');
    } else setView(id);
  };
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>('auto');
  const [onboardingStep, setOnboardingStep] = useState<number | undefined>(undefined);

  const userId = account.me?.id ?? 'dev';
  useEffect(() => {
    setOnboardingMode('auto');
    setOnboardingStep(undefined);
  }, [userId]);

  // A token the server rejects (revoked, expired, or from another server) signs this device out.
  const { signOut } = auth;
  useEffect(() => {
    if (auth.status === 'signedIn' && account.unauthorized) void signOut();
  }, [auth.status, account.unauthorized, signOut]);

  if (auth.status === 'loading') return <div className="bg-background h-screen" />;
  // A development token in the environment lets the app run without an account.
  if (auth.status === 'signedOut' && !isDevToken()) {
    return (
      <LoginScreen
        phase={auth.phase}
        onSignIn={() => void auth.signIn()}
        serverSlot={<ServerLink />}
      />
    );
  }
  if (auth.status === 'signedIn' && account.loading)
    return <div className="bg-background h-screen" />;

  const showOnboarding = shouldShowOnboarding(onboardingMode, userId);
  if (showOnboarding) {
    return (
      <OnboardingFlow
        userId={userId}
        initialStep={onboardingStep}
        onFinish={() => {
          completeOnboarding(userId);
          setOnboardingMode('complete');
        }}
        // Leaving keeps the open steps as cards on the home page, so the guide does not return on its own.
        onExit={() => {
          completeOnboarding(userId);
          setOnboardingMode('complete');
        }}
      />
    );
  }

  const reviewOnboarding = () => {
    clearOnboarding(userId);
    setOnboardingStep(0);
    setOnboardingMode('open');
  };
  const resumeOnboarding = (step: number) => {
    setOnboardingStep(step);
    setOnboardingMode('open');
  };

  return (
    <MotionConfig reducedMotion="user">
      <AppShell view={view} onNavigate={navigate} onSignOut={() => void auth.signOut()}>
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
              reviewTab={reviewTab}
              onReviewTab={setReviewTab}
              onResumeOnboarding={resumeOnboarding}
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
  reviewTab,
  onReviewTab,
  onResumeOnboarding,
  onSignOut,
  onReviewOnboarding,
}: {
  view: string;
  reviewTab: string;
  onReviewTab(tab: string): void;
  onResumeOnboarding(step: number): void;
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
        <Page tab={reviewTab} onTab={onReviewTab} />
      </>
    );
  }

  if (view === 'home') return <HomePage onResumeOnboarding={onResumeOnboarding} />;
  if (view === 'meetings') return <MeetingsPage />;
  if (view === 'feedback') return <FeedbackPage />;
  if (view === 'settings') {
    return <SettingsPage onSignOut={onSignOut} onReviewOnboarding={onReviewOnboarding} />;
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
