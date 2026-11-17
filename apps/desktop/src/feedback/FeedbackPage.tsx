import { FeedbackForm } from '@cuelingo/ui/components/feedback-form';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { APP_VERSION } from '../app/brand';
import { sendFeedback } from './feedback-api';

/** What the person is told is sent: their words and the app version, nothing from a meeting. */
export const FEEDBACK_NOTE = `Chỉ gửi nội dung bạn viết và phiên bản app (${APP_VERSION}). Không gửi caption hay âm thanh.`;

/** Bug reports and ideas. The form comes from the shared UI, so web and desktop say the same thing. */
export function FeedbackPage() {
  return (
    <>
      <PageHeader
        title="Góp ý"
        description="Điều gì đang làm khó bạn, hoặc bạn muốn có thêm gì? Mọi phản hồi đều được đọc."
      />
      <div className="bg-card max-w-xl rounded-xl border p-5">
        <FeedbackForm note={FEEDBACK_NOTE} send={(input) => sendFeedback(input)} />
      </div>
    </>
  );
}
