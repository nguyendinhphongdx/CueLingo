import { spring } from '@animate-ui/react/utils/motion';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useState } from 'react';
import { PermissionsStep } from '../onboarding';
import { SessionPanel } from '../session';
import { AssistSettings } from '../settings';
import { AboutCard, ShortcutList } from './AboutCard';
import { AppShell, type View } from './AppShell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
    </header>
  );
}

export function App() {
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
                <Card>
                  <CardHeader>
                    <CardTitle>Phím tắt</CardTitle>
                    <CardDescription>
                      Dùng được ngay cả khi bạn đang ở trong app họp.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ShortcutList />
                  </CardContent>
                </Card>
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
