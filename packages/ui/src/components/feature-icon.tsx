import {
  BookOpenCheck,
  Bookmark,
  History,
  Languages,
  MessageSquare,
  Mic,
  Settings,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { FeatureIconName } from '../lib/roadmap';

const icons: Record<FeatureIconName, LucideIcon> = {
  mic: Mic,
  history: History,
  review: BookOpenCheck,
  bookmark: Bookmark,
  languages: Languages,
  progress: TrendingUp,
  settings: Settings,
  feedback: MessageSquare,
};

export function FeatureIcon({ name, className }: { name: FeatureIconName; className?: string }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className={className} strokeWidth={2} />;
}
