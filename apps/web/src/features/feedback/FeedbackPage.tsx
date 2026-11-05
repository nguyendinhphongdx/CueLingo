'use client';

import { FeedbackForm } from '@cuelingo/ui/components/feedback-form';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { client } from '../../lib/client';
import { webClientInfo } from './client-info';

/** Bug reports and ideas from the web app. The app version is `web`; the OS is what the browser reports. */
export function FeedbackPage() {
  return (
    <>
      <PageHeader
        title="Góp ý"
        description="Báo lỗi hoặc cho đội CueLingo biết bạn muốn gì thêm. Mọi phản hồi đều được đọc."
      />
      <div className="max-w-xl">
        <FeedbackForm
          send={async ({ kind, message }) => {
            await client.feedback.send({ kind, message, client: 'web', ...webClientInfo() });
          }}
        />
      </div>
    </>
  );
}
