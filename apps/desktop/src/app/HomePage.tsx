import type { LanguageCode } from '@cuelingo/shared';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import { CalendarHintCard } from '../calendar';
import { hasCalendar } from '../lib/platform';
import {
  isMeetingLive,
  RecentSessions,
  SessionPanel,
  useMeetingControls,
  useSession,
} from '../session';
import { AssistSuggestionBanner } from '../settings';
import { UpdateBanner } from '../updater';
import { UsageNotice } from '../usage';
import { OnboardingCards } from '../onboarding';
import { ShortcutList } from './AboutCard';

/** The Phiên họp page: what is next (fix, start, or the meeting about to begin), then recent meetings. */
export function HomePage({ onResumeOnboarding }: { onResumeOnboarding(step: number): void }) {
  const controls = useMeetingControls();
  const { status } = useSession();
  // The language is switched by the controls once the meeting really starts, not here.
  const startFor = (language?: LanguageCode) => void controls.attempt(language);
  return (
    <>
      <PageHeader title="Phiên họp" description="Bật caption cho cuộc họp đang mở trên máy bạn." />
      <UpdateBanner />
      <OnboardingCards onResume={onResumeOnboarding} />
      <UsageNotice />
      <AssistSuggestionBanner />
      {hasCalendar() && !isMeetingLive(status) ? <CalendarHintCard onStart={startFor} /> : null}
      <SessionPanel controls={controls} />
      <RecentSessions />
      <Section title="Phím tắt">
        <div className="bg-card rounded-xl border px-4 py-3">
          <ShortcutList />
        </div>
      </Section>
    </>
  );
}
