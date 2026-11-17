import { LegacyReviewRedirect } from '../../../features/review';

// Old address: kept as a page so the static build still answers it; the permanent redirect is in `lib/legacy-redirects.ts`.
export default function Page() {
  return <LegacyReviewRedirect tab="phrases" />;
}
