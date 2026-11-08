import { createClient } from '@cuelingo/core-sdk';
import type { FeedbackFormKind } from '@cuelingo/ui/components/feedback-form';
import { currentToken } from '../auth';
import { native } from '../lib/native';
import { serverConfig } from '../server';

/** Sends feedback with the app and OS version. Nothing from a meeting can reach this function. */
export async function sendFeedback(
  input: { kind: FeedbackFormKind; message: string },
  client = createClient({ baseUrl: serverConfig().apiUrl, getToken: currentToken }),
  info = native.appInfo,
): Promise<void> {
  const { version, os } = await info();
  await client.feedback.send({
    kind: input.kind,
    message: input.message,
    client: 'desktop',
    appVersion: version,
    os,
  });
}
