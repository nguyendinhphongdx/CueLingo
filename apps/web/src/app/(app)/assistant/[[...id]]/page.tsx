import { AssistantPage } from '../../../../features/assistant';

export default async function Page({ params }: PageProps<'/assistant/[[...id]]'>) {
  const { id } = await params;
  return <AssistantPage conversationId={id?.[0]} />;
}
