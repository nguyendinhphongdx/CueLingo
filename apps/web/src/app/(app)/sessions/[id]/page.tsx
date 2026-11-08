import { DebriefRoute } from '../../../../features/debrief';
import { PLACEHOLDER_ID } from '../../../../lib/route-id';

// One placeholder page: the static export cannot list the ids; the id is read from the URL in the browser.
export function generateStaticParams() {
  return [{ id: PLACEHOLDER_ID }];
}

export default function Page() {
  return <DebriefRoute />;
}
