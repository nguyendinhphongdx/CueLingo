import { spring } from '@animate-ui/react/utils/motion';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useState } from 'react';
import { useColorScheme } from './use-color-scheme';
import { PermissionsStep } from '../onboarding';
import { SessionPanel } from '../session';
import { AssistSettings } from '../settings';
import { AboutCard, ShortcutList } from './AboutCard';
import { AppShell, type View } from './AppShell';

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header>
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
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
            {view === 'home' ? (
              <>
                <PageHeader
                  title="Phiên họp"
                  description="Bật caption trước khi vào cuộc họp, rồi mở Zoom, Meet hoặc Teams như bình thường."
                />
                <SessionPanel />
                <AssistSettings />
                <section aria-labelledby="shortcuts-title" className="space-y-3">
                  <h2 id="shortcuts-title" className="text-sm font-semibold">
                    Phím tắt
                  </h2>
                  <div className="bg-card rounded-xl border px-4 py-3">
                    <ShortcutList />
                  </div>
                </section>
              </>
            ) : (
              <>
                <PageHeader
                  title="Cài đặt"
                  description="Quyền truy cập và thông tin về ứng dụng."
                />
                <PermissionsStep />
                <AboutCard />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </AppShell>
    </MotionConfig>
  );
}
