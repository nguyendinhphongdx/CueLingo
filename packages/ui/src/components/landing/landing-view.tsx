import { buttonVariants } from '../button';
import { CaptionOverlay } from './caption-overlay';
import {
  DEFAULT_LANDING_PATHS,
  PlainLink,
  type LandingLink,
  type LandingPaths,
} from './landing-link';
import styles from './landing.module.css';
import { PublicHeader } from './public-header';

const capabilities = [
  {
    title: 'Theo kịp điều đang được nói',
    description:
      'Caption tiếng Anh, Nhật, Hàn, Trung kèm bản dịch tiếng Việt xuất hiện cùng lúc để bạn vẫn nghe được giọng thật, mà không bỏ lỡ ý chính.',
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

/** The public landing page. Pure presentation: the host app supplies its router link and where links point. */
export function LandingView({
  link: Link = PlainLink,
  paths = DEFAULT_LANDING_PATHS,
}: {
  link?: LandingLink;
  paths?: LandingPaths;
}) {
  return (
    <main>
      <PublicHeader link={Link} paths={paths} />

      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <h1 id="landing-title">Nghe hiểu cuộc họp đa ngôn ngữ</h1>
          <p>
            Caption kèm bản dịch tiếng Việt cho cuộc họp tiếng Anh, Nhật, Hàn, Trung; tiếng Việt có
            bản ghi lời. CueLingo dành cho người đi làm đọc tốt nhưng khó theo kịp khi đồng nghiệp
            nói.
          </p>
          <div className={styles.heroActions}>
            <Link
              href={paths.download}
              className={`${buttonVariants({ size: 'lg' })} min-h-11 ${styles.primaryAction}`}
            >
              Tải cho macOS
            </Link>
            {paths.login ? (
              <Link className={styles.textAction} href={paths.login}>
                Đăng nhập
              </Link>
            ) : null}
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
          <h2 id="privacy-title">Tiếng Anh ở lại trên máy</h2>
          <p>
            Với tiếng Anh, nhận dạng giọng nói chạy ngay trên máy Mac và chỉ văn bản được gửi đi để
            dịch. Tiếng Nhật, Hàn, Trung và Việt được nhận dạng trên đám mây, chỉ khi bạn đồng ý.
            Bạn có thể xoá dữ liệu bất cứ lúc nào.
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
            href={paths.download}
            className={`${buttonVariants({ size: 'lg' })} min-h-11 ${styles.primaryAction}`}
          >
            Xem cách cài đặt
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>CueLingo</p>
        <nav aria-label="Điều hướng cuối trang">
          <Link href={paths.download}>Tải ứng dụng</Link>
          {paths.login ? <Link href={paths.login}>Đăng nhập</Link> : null}
        </nav>
      </footer>
    </main>
  );
}

/** Shown by a host that checks the sign-in session before it knows which landing to draw. */
export function LandingSessionCheck() {
  return (
    <main className={styles.sessionCheck} aria-live="polite">
      Đang kiểm tra phiên đăng nhập…
    </main>
  );
}
