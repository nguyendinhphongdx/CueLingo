import { Suspense } from 'react';
import { AdminUsersPage } from '../../../../features/admin';

export default function Page() {
  // useSearchParams (the quota filter from the usage page) needs a Suspense boundary for the static export.
  return (
    <Suspense fallback={null}>
      <AdminUsersPage />
    </Suspense>
  );
}
