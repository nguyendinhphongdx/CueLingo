import { Suspense } from 'react';
import { CheckoutPage } from '../../../features/billing';

export default function Page() {
  // useSearchParams needs a Suspense boundary for the static export.
  return (
    <Suspense fallback={null}>
      <CheckoutPage />
    </Suspense>
  );
}
