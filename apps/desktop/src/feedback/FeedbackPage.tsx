import { FeedbackForm } from '@cuelingo/ui/components/feedback-form';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { sendFeedback } from './feedback-api';

/** Bug reports and ideas. The form comes from the shared UI, so web and desktop say the same thing. */
export function FeedbackPage() {
  return (
    <>
      <PageHeader
        title="Góp ý"
        description="Báo lỗi hoặc cho đội CueLingo biết bạn muốn gì thêm. Mọi phản hồi đều được đọc."
      />
      <div className="max-w-xl">
        <FeedbackForm send={(input) => sendFeedback(input)} />
      </div>
    </>
  );
}
