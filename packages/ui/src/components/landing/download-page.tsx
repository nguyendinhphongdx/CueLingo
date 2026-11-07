import { Button, buttonVariants } from '../button';
import { CaptionOverlay } from './caption-overlay';
import {
  DEFAULT_LANDING_PATHS,
  PlainLink,
  type LandingLink,
  type LandingPaths,
} from './landing-link';
import styles from './landing.module.css';
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
    <main>
      <PublicHeader link={Link} paths={paths} />

      <section className={styles.downloadHero} aria-labelledby="download-title">
        <div>
          <h1 id="download-title">Cài CueLingo trên máy Mac</h1>
          <p>
            Dành cho macOS 14.2 trở lên. Hoàn tất bốn bước để CueLingo nghe được cả micro và âm
            thanh cuộc họp.
          </p>
          {downloadUrl ? (
            <a
              className={`${buttonVariants({ size: 'lg' })} min-h-11 ${styles.primaryAction}`}
              href={downloadUrl}
            >
              Tải cho macOS
            </a>
          ) : (
            <Button className={`min-h-11 ${styles.disabledAction}`} size="lg" disabled>
              Sắp có bản tải
            </Button>
          )}
        </div>
        <CaptionOverlay compact />
      </section>

      <section className={styles.requirements} aria-labelledby="requirements-title">
        <h2 id="requirements-title">Máy Mac cần gì?</h2>
        <div>
          <strong>macOS 14.2 trở lên</strong>
          <p>
            CueLingo cần quyền micro và ghi âm hệ thống để tạo caption cho cả giọng của bạn lẫn
            người trong cuộc họp.
          </p>
        </div>
      </section>

      <section className={styles.installation} aria-labelledby="installation-title">
        <div className={styles.sectionIntro}>
          <h2 id="installation-title">Cài đặt và cấp quyền</h2>
          <p>Làm lần lượt các bước dưới đây. Bạn có thể đổi quyền bất cứ lúc nào.</p>
        </div>
        <ol className={styles.stepList}>
          {installationSteps.map((step) => (
            <li key={step.title}>
              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.troubleshooting} aria-labelledby="troubleshooting-title">
        <h2 id="troubleshooting-title">Nếu caption chưa xuất hiện</h2>
        <div>
          <p>
            Sau mỗi lần CueLingo tự cập nhật, macOS có thể hỏi lại quyền micro và ghi âm hệ thống.
            Hãy bật lại hai quyền đó rồi mở lại CueLingo.
          </p>
          <p>
            Kiểm tra lại hai quyền trong Quyền riêng tư & Bảo mật, rồi thoát hẳn và mở lại CueLingo.
          </p>
          <p>
            Nếu ứng dụng không mở, vào Cài đặt hệ thống → Quyền riêng tư & Bảo mật và chọn Open
            Anyway cho CueLingo.
          </p>
        </div>
      </section>

      <footer className={styles.downloadFooter}>
        <Link href={paths.home}>Về trang giới thiệu</Link>
        <span>CueLingo cho macOS</span>
      </footer>
    </main>
  );
}
