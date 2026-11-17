import { Button } from '@cuelingo/ui/components/button';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { ListCard, Section } from '@cuelingo/ui/components/section';
import { SoonBadge } from '@cuelingo/ui/components/soon-badge';
import { ThemeSwitch } from '@cuelingo/ui/components/theme-switch';
import { upcoming } from '@cuelingo/ui/lib/roadmap';
import { useState, type ReactNode } from 'react';
import { AccountCard } from '../auth';
import { CalendarSettings } from '../calendar';
import { LanguageModels } from '../models/LanguageModels';
import { useLocalModels } from '../models/use-local-models';
import { PermissionsStep } from '../onboarding';
import { PrivacyPanel } from '../privacy';
import { ServerSettings } from '../server-picker';
import { AssistSettings, VoiceSettings } from '../settings';
import { PlacementSection } from '../study';
import { UsagePanel } from '../usage';
import { hasCalendar } from '../lib/platform';
import { AboutCard } from './AboutCard';

export type SettingsSectionId =
  | 'account'
  | 'meeting'
  | 'models'
  | 'appearance'
  | 'voice'
  | 'calendar'
  | 'privacy'
  | 'device'
  | 'about';

interface SectionDef {
  id: SettingsSectionId;
  label: string;
  /** Only on systems that have it (the calendar reads EventKit). */
  available?: () => boolean;
}

/** The left list of Cài đặt, in the order a person looks for things. */
export const SETTINGS_SECTIONS: SectionDef[] = [
  { id: 'account', label: 'Tài khoản và gói' },
  { id: 'meeting', label: 'Họp và caption' },
  { id: 'models', label: 'Mô hình' },
  { id: 'appearance', label: 'Giao diện' },
  { id: 'voice', label: 'Giọng đọc' },
  { id: 'calendar', label: 'Lịch', available: hasCalendar },
  { id: 'privacy', label: 'Quyền riêng tư' },
  { id: 'device', label: 'Thiết bị và máy chủ' },
  { id: 'about', label: 'Cập nhật và giới thiệu' },
];

export const visibleSections = (sections: readonly SectionDef[] = SETTINGS_SECTIONS) =>
  sections.filter((section) => section.available?.() ?? true);

/** Pure left navigation, so it renders and tests without the data hooks behind each section. */
export function SettingsNav({
  sections,
  active,
  onSelect,
}: {
  sections: readonly Pick<SectionDef, 'id' | 'label'>[];
  active: SettingsSectionId;
  onSelect(id: SettingsSectionId): void;
}) {
  return (
    <nav
      aria-label="Mục cài đặt"
      className="flex gap-1 overflow-x-auto md:w-52 md:shrink-0 md:flex-col"
    >
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          aria-current={section.id === active ? 'page' : undefined}
          onClick={() => onSelect(section.id)}
          className={`focus-visible:ring-ring h-10 shrink-0 cursor-pointer rounded-lg px-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
            section.id === active
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

function Roadmap() {
  return (
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
  );
}

function Guide({ onReviewOnboarding }: { onReviewOnboarding(): void }) {
  return (
    <Section title="Hướng dẫn">
      <div className="bg-card flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Làm quen với CueLingo</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Xem lại các bước về quyền, mô hình, mức hỗ trợ và phím tắt.
          </p>
        </div>
        <Button variant="outline" className="shrink-0" onClick={onReviewOnboarding}>
          Xem lại hướng dẫn
        </Button>
      </div>
    </Section>
  );
}

function SectionBody({
  id,
  onSignOut,
  onReviewOnboarding,
}: {
  id: SettingsSectionId;
  onSignOut(): void;
  onReviewOnboarding(): void;
}): ReactNode {
  switch (id) {
    case 'account':
      return (
        <>
          <AccountCard onSignOut={onSignOut} />
          <UsagePanel />
        </>
      );
    case 'meeting':
      return (
        <>
          <AssistSettings />
          <PermissionsStep />
          <PlacementSection />
        </>
      );
    case 'models':
      return <LanguageModels />;
    case 'appearance':
      return <ThemeSwitch />;
    case 'voice':
      return <VoiceSettings />;
    case 'calendar':
      return <CalendarSettings />;
    case 'privacy':
      return <PrivacyPanel />;
    case 'device':
      return <ServerSettings />;
    case 'about':
      return (
        <>
          <AboutCard />
          <Guide onReviewOnboarding={onReviewOnboarding} />
          <Roadmap />
        </>
      );
  }
}

/** Cài đặt: a list of sections on the left, one section at a time on the right. */
export function SettingsPage({
  onSignOut,
  onReviewOnboarding,
}: {
  onSignOut(): void;
  onReviewOnboarding(): void;
}) {
  const models = useLocalModels();
  // Only where the app can download models (the list would be a half truth otherwise).
  const sections = visibleSections().filter(
    (section) => section.id !== 'models' || models.supported,
  );
  const [active, setActive] = useState<SettingsSectionId>('account');
  return (
    <>
      <PageHeader title="Cài đặt" />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <SettingsNav sections={sections} active={active} onSelect={setActive} />
        <div className="flex min-w-0 grow flex-col gap-6">
          <SectionBody id={active} onSignOut={onSignOut} onReviewOnboarding={onReviewOnboarding} />
        </div>
      </div>
    </>
  );
}
