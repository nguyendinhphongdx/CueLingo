'use client';

import { useThemeMode } from '../hooks/use-theme-mode';
import { THEME_MODES } from '../lib/theme';
import { Segmented } from './segmented';
import { Section } from './section';

/** Cài đặt › Giao diện: follow the system, or force light or dark. The same block on web and desktop. */
export function ThemeSwitch() {
  const [mode, setMode] = useThemeMode();
  return (
    <Section title="Giao diện" description="Mặc định theo chế độ sáng hoặc tối của hệ điều hành.">
      <Segmented label="Giao diện" value={mode} onChange={setMode} options={THEME_MODES} />
    </Section>
  );
}
