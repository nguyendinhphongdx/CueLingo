import { followTheme } from '@cuelingo/ui/lib/theme';

/** The shared tokens switch on `.dark`; this keeps that class in step with the saved choice or the system. */
export function followColorScheme(): void {
  followTheme();
}
