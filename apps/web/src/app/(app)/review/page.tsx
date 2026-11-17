import { Suspense } from 'react';
import { ReviewTabsPage } from '../../../features/review';

export default function Page() {
  // useSearchParams (the open tab) needs a Suspense boundary for the static export.
  return (
    <Suspense fallback={null}>
      <ReviewTabsPage />
    </Suspense>
  );
}
