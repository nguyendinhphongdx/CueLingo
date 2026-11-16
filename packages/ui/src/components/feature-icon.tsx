import {
  BookOpenCheck,
  Bookmark,
  Activity,
  BarChart3,
  KeyRound,
  LayoutDashboard,
  Users,
  Wallet,
  History,
  Languages,
  MessageSquare,
  Sparkles,
  Mic,
  Settings,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { FeatureIconName } from '../lib/roadmap';

/** Icons for entries that are not roadmap features (the admin group). */
export type AdminIconName = 'dashboard' | 'users' | 'revenue' | 'usage' | 'activity' | 'invites';
export type NavIconName = FeatureIconName | AdminIconName;

const icons: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  revenue: Wallet,
  usage: BarChart3,
  activity: Activity,
  invites: KeyRound,
  mic: Mic,
  history: History,
  review: BookOpenCheck,
  bookmark: Bookmark,
  languages: Languages,
  progress: TrendingUp,
  settings: Settings,
  feedback: MessageSquare,
  assistant: Sparkles,
};

export function FeatureIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className={className} strokeWidth={2} />;
}
