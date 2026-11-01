import { DebriefPage } from '../../../../features/debrief';

export default async function Page({ params }: PageProps<'/sessions/[id]'>) {
  const { id } = await params;
  return <DebriefPage sessionId={id} />;
}
