import {
  DEFAULT_LANDING_PATHS,
  PlainLink,
  type LandingLink,
  type LandingPaths,
} from './landing-link';
import styles from './landing.module.css';
import { CaptionFragment } from './product-visuals';
import { PublicHeader } from './public-header';

const installationSteps = [
  {
    title: 'Đưa CueLingo vào Applications',
    description: 'Mở tệp tải về, rồi kéo CueLingo vào thư mục Applications.',
  },
  {
    title: 'Mở ứng dụng lần đầu (bản beta chưa được Apple công chứng)',
    description:
      'macOS sẽ chặn lần mở đầu. Trên macOS 15: bấm Done, vào Cài đặt hệ thống → Quyền riêng tư & Bảo mật, kéo xuống và bấm Open Anyway cho CueLingo. Trên macOS 14: bấm chuột phải vào CueLingo trong Applications, chọn Open, rồi chọn Open lần nữa.',
  },
  {
    title: 'Cho phép dùng micro',
    description: 'Vào Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Microphone và bật CueLingo.',
  },
  {
    title: 'Cho phép ghi âm hệ thống',
    description:
      'Vào Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Screen & System Audio Recording và bật CueLingo.',
  },
];

export function DownloadPage({
  downloadUrl,
  link: Link = PlainLink,
  paths = DEFAULT_LANDING_PATHS,
}: {
  downloadUrl: string | null;
  link?: LandingLink;
  paths?: LandingPaths;
}) {
  return (
    <main className={styles.page}>
      <PublicHeader link={Link} paths={paths} />

      <section className={styles.downloadHero} aria-labelledby="download-title">
        <div className={styles.downloadHeroCopy}>
          <h1 id="download-title" className={styles.reveal}>
            Cài CueLingo trên máy Mac
          </h1>
          <p className={`${styles.lead} ${styles.reveal} ${styles.reveal2}`}>
            Dành cho macOS 14.2 trở lên trên máy Mac chip Apple Silicon (M1 trở lên). Hoàn tất bốn
            bước để CueLingo nghe được cả micro và âm thanh cuộc họp.
          </p>
          <div className={`${styles.heroActions} ${styles.reveal} ${styles.reveal3}`}>
            {downloadUrl ? (
              <a className={styles.primaryAction} href={downloadUrl}>
                Tải cho macOS
              </a>
            ) : (
              <button type="button" className={styles.disabledAction} disabled>
                Sắp có bản tải
              </button>
            )}
          </div>
        </div>
        <div className={styles.heroStage}>
          <div className={styles.heroShape} aria-hidden="true" />
          <div className={styles.heroShapeShort} aria-hidden="true" />
          <div className={styles.heroFragment}>
            <CaptionFragment compact />
          </div>
        </div>
      </section>

      <div className={styles.downloadBody}>
        <section className={styles.downloadBlock} aria-labelledby="requirements-title">
          <h2 id="requirements-title">Máy Mac cần gì?</h2>
          <div className={styles.downloadBlockBody}>
            <strong>macOS 14.2 trở lên, chip Apple Silicon</strong>
            <p>
              Bản tải về dành cho máy Mac chip Apple Silicon (M1 trở lên), chưa có bản cho Mac chip
              Intel. CueLingo cần quyền micro và ghi âm hệ thống để tạo caption cho cả giọng của bạn
              lẫn người trong cuộc họp.
            </p>
          </div>
        </section>

        <section className={styles.downloadBlock} aria-labelledby="installation-title">
          <h2 id="installation-title">Cài đặt và cấp quyền</h2>
          <div className={styles.downloadBlockBody}>
            <p>Làm lần lượt các bước dưới đây. Bạn có thể đổi quyền bất cứ lúc nào.</p>
            <ol className={styles.steps}>
              {installationSteps.map((step) => (
                <li key={step.title}>
                  <span className={styles.stepMark} aria-hidden="true" />
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.downloadBlock} aria-labelledby="updates-title">
          <h2 id="updates-title">Cập nhật</h2>
          <div className={styles.downloadBlockBody}>
            <strong>App tự kiểm tra bản mới</strong>
            <p>
              CueLingo tự kiểm tra bản mới mỗi khi mở và định kỳ trong lúc chạy, nên bạn không cần
              quay lại trang này. Khi có bản mới, app hỏi bạn trước và chỉ cài khi bạn bấm Cập nhật;
              đang họp thì app chờ đến khi họp xong.
            </p>
          </div>
        </section>

        <section className={styles.downloadBlock} aria-labelledby="troubleshooting-title">
          <h2 id="troubleshooting-title">Nếu caption chưa xuất hiện</h2>
          <div className={styles.downloadBlockBody}>
            <p>
              Sau mỗi lần CueLingo tự cập nhật, macOS có thể hỏi lại quyền micro và ghi âm hệ thống.
              Hãy bật lại hai quyền đó rồi mở lại CueLingo.
            </p>
            <p>
              Kiểm tra lại hai quyền trong Quyền riêng tư & Bảo mật, rồi thoát hẳn và mở lại
              CueLingo.
            </p>
            <p>
              Nếu ứng dụng không mở, vào Cài đặt hệ thống → Quyền riêng tư & Bảo mật và chọn Open
              Anyway cho CueLingo.
            </p>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLinks}>
            <nav aria-label="Điều hướng cuối trang">
              <Link href={paths.home}>Về trang giới thiệu</Link>
              {paths.login ? <Link href={paths.login}>Đăng nhập</Link> : null}
            </nav>
            <p>CueLingo cho macOS</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
