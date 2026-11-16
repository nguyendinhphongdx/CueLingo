'use client';

import {
  downloadView,
  NO_DOWNLOADS,
  useDetectedOs,
  type DownloadLinks,
  type DownloadOs,
  type DownloadView,
} from './detect-os';
import {
  DEFAULT_LANDING_PATHS,
  PlainLink,
  type LandingLink,
  type LandingPaths,
} from './landing-link';
import styles from './landing.module.css';
import { CaptionFragment } from './product-visuals';
import { PublicHeader } from './public-header';

type Os = 'macos' | 'windows';

const macSteps = [
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

const windowsSteps = [
  {
    title: 'Chạy bản cài',
    description:
      'Mở tệp CueLingo-Windows-x64-setup.exe vừa tải. Bản cài chỉ cài cho tài khoản của bạn, không cần quyền quản trị.',
  },
  {
    title: 'Vượt cảnh báo SmartScreen (bản beta chưa được ký số)',
    description:
      'Windows có thể hiện hộp thoại "Windows protected your PC". Bấm More info, rồi bấm Run anyway. Chỉ cần làm một lần cho mỗi bản cài.',
  },
  {
    title: 'Cho phép dùng micro',
    description:
      'Vào Cài đặt → Quyền riêng tư (Privacy) → Micrô (Microphone), bật quyền cho ứng dụng và cho ứng dụng trên máy tính (desktop apps).',
  },
  {
    title: 'Chọn đúng thiết bị phát',
    description:
      'Windows không cần cấp quyền ghi âm hệ thống. CueLingo nghe thiết bị phát mặc định, nên hãy chọn đúng loa hoặc tai nghe bạn dùng cho cuộc họp.',
  },
];

const steps: Record<Os, typeof macSteps> = { macos: macSteps, windows: windowsSteps };

const copy: Record<DownloadView, { title: string; lead: string }> = {
  macos: {
    title: 'Cài CueLingo trên máy Mac',
    lead: 'Dành cho macOS 14.2 trở lên trên máy Mac chip Apple Silicon (M1 trở lên). Hoàn tất bốn bước để CueLingo nghe được cả micro và âm thanh cuộc họp.',
  },
  windows: {
    title: 'Cài CueLingo trên Windows',
    lead: 'Dành cho Windows 10 (22H2) hoặc Windows 11, bản 64-bit (x64). Hoàn tất bốn bước để CueLingo nghe được cả micro và âm thanh cuộc họp.',
  },
  both: {
    title: 'Cài CueLingo',
    lead: 'Chọn bản cho máy của bạn: macOS 14.2 trở lên (chip Apple Silicon) hoặc Windows 10 (22H2) trở lên (x64).',
  },
  'windows-soon': {
    title: 'Windows sắp có',
    lead: 'CueLingo chưa có bản cho Windows. Hiện app chỉ cài được trên máy Mac (macOS 14.2 trở lên, chip Apple Silicon). Bạn quay lại trang này khi bản Windows ra mắt.',
  },
};

function MacRequirements({ id }: { id: string }) {
  return (
    <section className={styles.downloadBlock} aria-labelledby={id}>
      <h2 id={id}>Máy Mac cần gì?</h2>
      <div className={styles.downloadBlockBody}>
        <strong>macOS 14.2 trở lên, chip Apple Silicon</strong>
        <p>
          Bản tải về dành cho máy Mac chip Apple Silicon (M1 trở lên), chưa có bản cho Mac chip
          Intel. CueLingo cần quyền micro và ghi âm hệ thống để tạo caption cho cả giọng của bạn lẫn
          người trong cuộc họp.
        </p>
      </div>
    </section>
  );
}

function WindowsRequirements({ id }: { id: string }) {
  return (
    <section className={styles.downloadBlock} aria-labelledby={id}>
      <h2 id={id}>Máy Windows cần gì?</h2>
      <div className={styles.downloadBlockBody}>
        <strong>Windows 10 (22H2) hoặc Windows 11, 64-bit (x64)</strong>
        <p>
          Chưa có bản cho Windows ARM64. CueLingo cần quyền micro để nghe giọng của bạn; âm thanh
          của người trong cuộc họp được thu từ thiết bị phát mặc định và không cần cấp quyền riêng.
        </p>
      </div>
    </section>
  );
}

function Downloads({ view, links }: { view: DownloadView; links: DownloadLinks }) {
  const { macos, windows } = links;
  const macButton = macos ? (
    <a className={styles.primaryAction} href={macos}>
      Tải cho macOS
    </a>
  ) : (
    <button type="button" className={styles.disabledAction} disabled>
      Sắp có bản tải
    </button>
  );

  if (view === 'windows-soon') {
    return (
      <button type="button" className={styles.disabledAction} disabled>
        Windows sắp có
      </button>
    );
  }
  if (view === 'windows') {
    return (
      <>
        <a className={styles.primaryAction} href={windows ?? undefined}>
          Tải cho Windows
        </a>
        {macos ? (
          <a className={styles.textAction} href={macos}>
            Dùng máy Mac? Tải cho macOS
          </a>
        ) : null}
      </>
    );
  }
  if (view === 'both') {
    return (
      <>
        {macButton}
        <a className={styles.primaryAction} href={windows ?? undefined}>
          Tải cho Windows
        </a>
      </>
    );
  }
  return (
    <>
      {macButton}
      {windows ? (
        <a className={styles.textAction} href={windows}>
          Dùng Windows? Tải cho Windows
        </a>
      ) : null}
    </>
  );
}

export function DownloadPage({
  downloads = NO_DOWNLOADS,
  link: Link = PlainLink,
  paths = DEFAULT_LANDING_PATHS,
  os,
}: {
  downloads?: DownloadLinks;
  link?: LandingLink;
  paths?: LandingPaths;
  /** Forces the visitor's system (previews and tests); left out, the browser is asked after mount. */
  os?: DownloadOs | null;
}) {
  const detected = useDetectedOs();
  const view = downloadView(os === undefined ? detected : os, downloads);
  const shown: readonly Os[] =
    view === 'both' ? ['macos', 'windows'] : view === 'windows' ? ['windows'] : ['macos'];
  const soon = view === 'windows-soon';
  const { title, lead } = copy[view];

  return (
    <main className={styles.page}>
      <PublicHeader link={Link} paths={paths} />

      <section className={styles.downloadHero} aria-labelledby="download-title">
        <div className={styles.downloadHeroCopy}>
          <h1 id="download-title" className={styles.reveal}>
            {title}
          </h1>
          <p className={`${styles.lead} ${styles.reveal} ${styles.reveal2}`}>{lead}</p>
          <div className={`${styles.heroActions} ${styles.reveal} ${styles.reveal3}`}>
            <Downloads view={view} links={downloads} />
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
        {view === 'both' ? (
          <>
            <MacRequirements id="requirements-title" />
            <WindowsRequirements id="requirements-windows-title" />
          </>
        ) : soon ? (
          <section className={styles.downloadBlock} aria-labelledby="requirements-title">
            <h2 id="requirements-title">Hiện có bản nào?</h2>
            <div className={styles.downloadBlockBody}>
              <strong>Chỉ macOS 14.2 trở lên, chip Apple Silicon</strong>
              <p>Bản Windows đang được hoàn thiện nên chưa có nút tải.</p>
            </div>
          </section>
        ) : view === 'windows' ? (
          <WindowsRequirements id="requirements-title" />
        ) : (
          <MacRequirements id="requirements-title" />
        )}

        {soon ? null : (
          <>
            <section className={styles.downloadBlock} aria-labelledby="installation-title">
              <h2 id="installation-title">Cài đặt và cấp quyền</h2>
              <div className={styles.downloadBlockBody}>
                <p>Làm lần lượt các bước dưới đây. Bạn có thể đổi quyền bất cứ lúc nào.</p>
                {shown.map((os) => (
                  <div key={os}>
                    {shown.length > 1 ? (
                      <h3>{os === 'macos' ? 'Trên macOS' : 'Trên Windows'}</h3>
                    ) : null}
                    <ol className={styles.steps}>
                      {steps[os].map((step) => (
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
                ))}
              </div>
            </section>

            <section className={styles.downloadBlock} aria-labelledby="updates-title">
              <h2 id="updates-title">Cập nhật</h2>
              <div className={styles.downloadBlockBody}>
                <strong>App tự kiểm tra bản mới</strong>
                <p>
                  CueLingo tự kiểm tra bản mới mỗi khi mở và định kỳ trong lúc chạy, nên bạn không
                  cần quay lại trang này. Khi có bản mới, app hỏi bạn trước và chỉ cài khi bạn bấm
                  Cập nhật; đang họp thì app chờ đến khi họp xong.
                </p>
              </div>
            </section>

            <section className={styles.downloadBlock} aria-labelledby="troubleshooting-title">
              <h2 id="troubleshooting-title">Nếu caption chưa xuất hiện</h2>
              <div className={styles.downloadBlockBody}>
                {shown.includes('macos') ? (
                  <>
                    <p>
                      Sau mỗi lần CueLingo tự cập nhật, macOS có thể hỏi lại quyền micro và ghi âm
                      hệ thống. Hãy bật lại hai quyền đó rồi mở lại CueLingo.
                    </p>
                    <p>
                      Kiểm tra lại hai quyền trong Quyền riêng tư & Bảo mật, rồi thoát hẳn và mở lại
                      CueLingo.
                    </p>
                    <p>
                      Nếu ứng dụng không mở, vào Cài đặt hệ thống → Quyền riêng tư & Bảo mật và chọn
                      Open Anyway cho CueLingo.
                    </p>
                  </>
                ) : null}
                {shown.includes('windows') ? (
                  <>
                    <p>
                      Trên Windows, kiểm tra quyền micro trong Cài đặt → Quyền riêng tư → Micrô, và
                      thiết bị phát mặc định là loa hoặc tai nghe bạn đang dùng. Sau đó thoát hẳn
                      CueLingo (bấm phải vào biểu tượng ở khay hệ thống) và mở lại.
                    </p>
                    <p>
                      Nếu SmartScreen chặn bản cài, bấm More info rồi Run anyway; bản beta chưa được
                      ký số.
                    </p>
                  </>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLinks}>
            <nav aria-label="Điều hướng cuối trang">
              <Link href={paths.home}>Về trang giới thiệu</Link>
              {paths.login ? <Link href={paths.login}>Đăng nhập</Link> : null}
            </nav>
            <p>{downloads.windows ? 'CueLingo cho macOS và Windows' : 'CueLingo cho macOS'}</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
