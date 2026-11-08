import { AssistantRoute } from '../../../../features/assistant';
import { PLACEHOLDER_ID } from '../../../../lib/route-id';

// `/assistant` plus one placeholder page; the id is read from the URL in the browser (see lib/route-id.ts).
export function generateStaticParams() {
  return [{ id: [] }, { id: [PLACEHOLDER_ID] }];
}

export default function Page() {
  return <AssistantRoute />;
}
