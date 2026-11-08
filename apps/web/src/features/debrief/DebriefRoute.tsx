'use client';

import { useRouteId } from '../../lib/use-route-id';
import { DebriefPage } from './DebriefPage';

/** `/sessions/<id>`: the id comes from the address bar, because the static build has one placeholder page. */
export function DebriefRoute() {
  const sessionId = useRouteId('/sessions');
  return sessionId ? <DebriefPage sessionId={sessionId} /> : null;
}
