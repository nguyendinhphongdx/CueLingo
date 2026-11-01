import { spring } from '@animate-ui/react/utils/motion';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useState } from 'react';
import { useColorScheme } from './use-color-scheme';
import { PermissionsStep } from '../onboarding';
import { RecentSessions, SessionPanel } from '../session';
import { AssistSettings } from '../settings';
import { AboutCard, ShortcutList } from './AboutCard';
import { AppShell } from './AppShell';
import { ComingSoon, SoonBadge } from './ComingSoon';
import { features, upcoming, type View } from './features';

function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header>
      <h1 className="text-2xl leading-tight font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
    </header>
  );
}

export function App() {
  useColorScheme();
  const [view, setView] = useState<View>('home');

  return (
    <MotionConfig reducedMotion="user">
      <AppShell view={view} onNavigate={setView}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: spring.pop }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <CurrentView view={view} />
          </motion.div>
        </AnimatePresence>
      </AppShell>
    </MotionConfig>
  );
}

function CurrentView({ view }: { view: View }) {
  const feature = features.find((item) => item.view === view)!;

  if (view === 'home') {
    return (
      <>
        <PageHeader title="Phiên họp" />
        <SessionPanel />
        <AssistSettings />
        <RecentSessions />
        <section aria-labelledby="shortcuts-title" className="space-y-3">
          <h2 id="shortcuts-title" className="text-sm font-semibold">
            Phím tắt
          </h2>
          <div className="bg-card rounded-xl border px-4 py-3">
            <ShortcutList />
          </div>
        </section>
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
        <PermissionsStep />
        <AboutCard />
        <section aria-labelledby="upcoming-title" className="space-y-3">
          <h2 id="upcoming-title" className="text-sm font-semibold">
            Đang trên lộ trình
          </h2>
          <ul className="bg-card divide-y rounded-xl border">
            {upcoming.map((item) => (
              <li key={item.title} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm">{item.description}</p>
                </div>
                <SoonBadge />
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  }
  return (
    <>
      <PageHeader title={feature.label} />
      <ComingSoon feature={feature} />
    </>
  );
}
