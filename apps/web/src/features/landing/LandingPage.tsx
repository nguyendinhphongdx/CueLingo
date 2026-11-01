'use client';

import { buttonVariants } from '@cuelingo/ui/components/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authClient } from '../../lib/auth-client';
import { CaptionOverlay } from './CaptionOverlay';
import styles from './landing.module.css';
import { PublicHeader } from './PublicHeader';
import { redirectSignedInVisitor } from './session-redirect';

const capabilities = [
  {
    title: 'Theo kịp điều đang được nói',
    description:
      'Caption tiếng Anh và bản dịch tiếng Việt xuất hiện cùng lúc để bạn vẫn nghe được giọng thật, mà không bỏ lỡ ý chính.',
  },
  {
    title: 'Hỏi ngay trong cuộc họp',
    description:
      'Tra một từ, tóm tắt đoạn vừa nghe hoặc soạn câu trả lời mà không phải rời khỏi cuộc trò chuyện.',
  },
  {
    title: 'Biến cuộc họp thành bài học',
    description:
      'Sau cuộc họp, xem debrief và ôn lại đúng những cụm từ đã xuất hiện trong công việc của bạn.',
  },
];

export function LandingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    redirectSignedInVisitor(session, isPending, router);
  }, [isPending, router, session]);

  if (isPending || session) {
    return (
      <main className={styles.sessionCheck} aria-live="polite">
        Đang kiểm tra phiên đăng nhập…
      </main>
    );
  }

  return (
    <main>
      <PublicHeader />

      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <h1 id="landing-title">Nghe hiểu cuộc họp tiếng Anh</h1>
          <p>
            Nghe hiểu cuộc họp tiếng Anh ngay khi nó diễn ra. CueLingo dành cho người đi làm đọc tốt
            nhưng khó theo kịp khi đồng nghiệp nói.
          </p>
          <div className={styles.heroActions}>
            <Link
              href="/download"
              className={`${buttonVariants({ size: 'lg' })} min-h-11 ${styles.primaryAction}`}
            >
              Tải cho macOS
            </Link>
            <Link className={styles.textAction} href="/login">
              Đăng nhập
            </Link>
          </div>
        </div>
        <CaptionOverlay />
      </section>

      <section className={styles.capabilities} aria-labelledby="capabilities-title">
        <div className={styles.sectionIntro}>
          <h2 id="capabilities-title">Một đường nghe liền mạch</h2>
          <p>Từ lúc ai đó bắt đầu nói đến khi bạn sẵn sàng dùng lại điều vừa học.</p>
        </div>
        <div className={styles.capabilityList}>
          {capabilities.map((capability) => (
            <article className={styles.capability} key={capability.title}>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.privacy} aria-labelledby="privacy-title">
        <div>
          <h2 id="privacy-title">Giọng nói ở lại trên máy</h2>
          <p>
            Nhận dạng giọng nói chạy ngay trên máy Mac. Chỉ văn bản được gửi đi để dịch, và bạn có
            thể xoá dữ liệu bất cứ lúc nào.
          </p>
        </div>
        <div className={styles.privacyFlow} aria-label="Cách CueLingo xử lý dữ liệu cuộc họp">
          <span>Âm thanh</span>
          <strong>Máy Mac của bạn</strong>
          <span>Văn bản để dịch</span>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="closing-title">
        <CaptionOverlay compact />
        <div>
          <h2 id="closing-title">Nghe cuộc họp. Học từ chính cuộc họp.</h2>
          <p>Cài CueLingo trên macOS để có hỗ trợ đúng lúc, rồi cần ít hỗ trợ hơn vào ngày mai.</p>
          <Link
            href="/download"
            className={`${buttonVariants({ size: 'lg' })} min-h-11 ${styles.primaryAction}`}
          >
            Xem cách cài đặt
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>CueLingo</p>
        <nav aria-label="Điều hướng cuối trang">
          <Link href="/download">Tải ứng dụng</Link>
          <Link href="/login">Đăng nhập</Link>
        </nav>
      </footer>
    </main>
  );
}
