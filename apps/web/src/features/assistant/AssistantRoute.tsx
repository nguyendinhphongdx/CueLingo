'use client';

import { useRouteId } from '../../lib/use-route-id';
import { AssistantPage } from './AssistantPage';

/** `/assistant` or `/assistant/<id>`: the id comes from the address bar, because the static build has one placeholder page. */
export function AssistantRoute() {
  return <AssistantPage conversationId={useRouteId('/assistant') ?? undefined} />;
}
