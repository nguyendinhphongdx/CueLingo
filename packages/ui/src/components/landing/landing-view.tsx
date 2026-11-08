import {
  DEFAULT_LANDING_PATHS,
  PlainLink,
  type LandingLink,
  type LandingPaths,
} from './landing-link';
import styles from './landing.module.css';
import { PublicHeader } from './public-header';
import {
  AskFragment,
  CaptionFragment,
  DebriefFragment,
  LookupFragment,
  ReviewFragment,
} from './product-visuals';
import { Stages, type Stage } from './stages';

const stages: readonly Stage[] = [
  {
    name: 'Nghe',
    clause: 'Đầu tiên, nghe cả hai thứ tiếng',
    note: 'Caption gốc và bản dịch tiếng Việt hiện cùng lúc ngay trên cuộc họp, nên bạn vẫn nghe giọng thật mà không bỏ lỡ ý chính.',
    visual: <CaptionFragment />,
  },
  {
    name: 'Hiểu',
    clause: 'Rồi tra ngay từ vừa nghe',
    note: 'Gặp một cụm từ lạ, bấm vào để xem nghĩa trong đúng câu đó và lưu lại để ôn.',
    visual: <LookupFragment />,
  },
  {
    name: 'Hỏi',
    clause: 'Cần gì thì hỏi trợ lý',
    note: 'Tóm tắt đoạn vừa nghe, hỏi một từ, hoặc soạn câu trả lời mà không phải rời cuộc trò chuyện.',
    visual: <AskFragment />,
  },
  {
    name: 'Nhớ',
    clause: 'Sau họp, ôn đúng cụm đó',
    note: 'Xem debrief của cuộc họp rồi ôn lại những cụm từ đã xuất hiện trong chính công việc của bạn.',
    visual: <ReviewFragment />,
  },
];

const faq = [
  {
    question: 'Dữ liệu cuộc họp của tôi đi đâu?',
    answer:
      'Với tiếng Anh, nhận dạng giọng nói chạy ngay trên máy Mac và chỉ văn bản được gửi đi để dịch. Tiếng Nhật, Hàn, Trung và Việt được nhận dạng trên đám mây, chỉ khi bạn đồng ý. Bạn có thể xoá dữ liệu của mình bất cứ lúc nào.',
  },
  {
    question: 'CueLingo hỗ trợ những ngôn ngữ nào?',
    answer:
      'Caption kèm bản dịch tiếng Việt cho cuộc họp tiếng Anh, Nhật, Hàn và Trung. Với tiếng Việt, CueLingo ghi lại lời nói thành văn bản.',
  },
  {
    question: 'Máy của tôi cần gì?',
    answer:
      'macOS 14.2 trở lên, trên máy Mac chip Apple Silicon (M1 trở lên). Chưa có bản cho Mac chip Intel. CueLingo cần quyền micro và ghi âm hệ thống để tạo caption cho cả giọng của bạn lẫn người trong cuộc họp.',
  },
  {
    question: 'Vì sao macOS chặn lần mở đầu tiên?',
    answer:
      'Bản beta chưa được Apple công chứng, nên macOS hỏi lại trước khi mở. Trang tải về có từng bước để cho phép; chỉ cần làm một lần.',
  },
  {
    question: 'Cập nhật bản mới như thế nào?',
    answer:
      'App tự kiểm tra bản mới khi mở và định kỳ trong lúc chạy. Khi có bản mới, app hỏi bạn trước và chỉ cài khi bạn bấm Cập nhật; đang họp thì app chờ đến khi họp xong.',
  },
];

const boardLangs = ['Anh', 'Nhật', 'Hàn', 'Trung'];

/** The public landing page. Pure presentation: the host app supplies its router link and where links point. */
export function LandingView({
  link: Link = PlainLink,
  paths = DEFAULT_LANDING_PATHS,
}: {
  link?: LandingLink;
  paths?: LandingPaths;
}) {
  return (
    <main className={styles.page}>
      <PublicHeader link={Link} paths={paths} />

      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <h1 id="landing-title" className={styles.reveal}>
            Nghe họp, hiểu ngay
          </h1>
          <p className={`${styles.lead} ${styles.reveal} ${styles.reveal2}`}>
            Caption song ngữ hiện ngay trên cuộc họp tiếng Anh, Nhật, Hàn, Trung của bạn, kèm bản
            dịch tiếng Việt.
          </p>
          <div className={`${styles.heroActions} ${styles.reveal} ${styles.reveal3}`}>
            <Link href={paths.download} className={styles.primaryAction}>
              Tải cho macOS
            </Link>
            {paths.login ? (
              <Link className={styles.textAction} href={paths.login}>
                Đăng nhập
              </Link>
            ) : null}
          </div>
        </div>
        <div className={styles.heroStage}>
          <div className={styles.heroShape} aria-hidden="true" />
          <div className={styles.heroShapeShort} aria-hidden="true" />
          <div className={styles.heroFragment}>
            <CaptionFragment />
          </div>
        </div>
      </section>

      <section className={styles.stages} aria-labelledby="stages-title">
        <div className={styles.stagesIntro}>
          <h2 id="stages-title">Từ lúc họ nói đến lúc bạn nhớ</h2>
        </div>
        <Stages stages={stages} />
      </section>

      <section className={styles.boardSection} aria-labelledby="board-title">
        <div className={styles.boardHeading}>
          <h2 id="board-title">Gọn trong lúc họp</h2>
          <p>Những chi tiết nhỏ giúp bạn tập trung vào người đang nói, không phải vào công cụ.</p>
        </div>
        <div className={styles.board} role="list">
          <article
            className={`${styles.tile} ${styles.tileA} ${styles.tileAccent} ${styles.scrollIn}`}
            role="listitem"
          >
            <div className={styles.tileSample} aria-hidden="true">
              <span className={styles.bigStatus} data-ui>
                <span className={styles.liveDot} />
                Đang nghe
              </span>
            </div>
            <h3>Luôn biết app đang làm gì</h3>
            <p>Trạng thái hiện rõ ngay trên overlay: đang nghe, đang dịch hay đã dừng.</p>
          </article>
          <article className={`${styles.tile} ${styles.tileB} ${styles.scrollIn}`} role="listitem">
            <div className={styles.tileSample} aria-hidden="true">
              <div className={styles.langPills} data-ui>
                {boardLangs.map((lang) => (
                  <span key={lang}>{lang}</span>
                ))}
                <span>→ Việt</span>
              </div>
            </div>
            <h3>Bốn ngôn ngữ nguồn</h3>
          </article>
          <article
            className={`${styles.tile} ${styles.tileC} ${styles.tileInk} ${styles.scrollIn}`}
            role="listitem"
          >
            <div className={styles.tileSample} aria-hidden="true">
              <div className={styles.discs} data-ui>
                <span className={styles.disc}>Họ</span>
                <span className={styles.disc}>Bạn</span>
              </div>
            </div>
            <h3>Phân biệt người nói</h3>
            <p>Giọng của bạn và giọng người khác được gắn nhãn riêng.</p>
          </article>
          <article
            className={`${styles.tile} ${styles.tileD} ${styles.tileAmber} ${styles.scrollIn}`}
            role="listitem"
          >
            <div className={styles.tileSample} aria-hidden="true">
              <span className={styles.bigWord} data-ui>
                align on
              </span>
            </div>
            <h3>Lưu cụm từ</h3>
          </article>
          <article className={`${styles.tile} ${styles.tileD} ${styles.scrollIn}`} role="listitem">
            <div className={styles.tileSample} aria-hidden="true">
              <span className={styles.toggleRow} data-ui>
                Trên máy
                <span className={styles.toggleTrack}>
                  <span />
                </span>
              </span>
            </div>
            <h3>Tiếng Anh ở lại trên máy</h3>
          </article>
          <article
            className={`${styles.tile} ${styles.tileB} ${styles.tileAccent} ${styles.tileSplit} ${styles.scrollIn}`}
            role="listitem"
          >
            <div className={styles.tileSample} aria-hidden="true">
              <div className={styles.cropped}>
                <DebriefFragment />
              </div>
            </div>
            <h3>Cuộc họp thành bài học</h3>
          </article>
        </div>
      </section>

      <section className={styles.privacy} aria-labelledby="privacy-title">
        <div className={styles.privacyInner}>
          <div>
            <h2 id="privacy-title">Tiếng Anh ở lại trên máy</h2>
            <div className={styles.privacyText}>
              <p>
                Với tiếng Anh, nhận dạng giọng nói chạy ngay trên máy Mac và chỉ văn bản được gửi đi
                để dịch.
              </p>
              <p>
                Tiếng Nhật, Hàn, Trung và Việt được nhận dạng trên đám mây, chỉ khi bạn đồng ý. Bạn
                có thể xoá dữ liệu bất cứ lúc nào.
              </p>
            </div>
          </div>
          <ol className={styles.flow} aria-label="Cách CueLingo xử lý dữ liệu cuộc họp">
            <li className={styles.scrollIn}>
              <span>Âm thanh cuộc họp</span>
            </li>
            <li>
              <strong>Máy Mac của bạn</strong>
              <span>nhận dạng giọng nói tiếng Anh</span>
            </li>
            <li>
              <span>Chỉ văn bản để dịch</span>
            </li>
          </ol>
        </div>
      </section>

      <section className={styles.faq} aria-labelledby="faq-title">
        <div className={styles.faqInner}>
          <h2 id="faq-title">Câu hỏi thường gặp</h2>
          <div className={styles.faqList}>
            {faq.map((item) => (
              <details className={`${styles.faqItem} ${styles.scrollIn}`} key={item.question}>
                <summary>
                  {item.question}
                  <span className={styles.faqMark} aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="closing-title">
        <div className={styles.closingInner}>
          <div className={styles.closingCopy}>
            <h2 id="closing-title">Học từ chính cuộc họp.</h2>
            <p>
              Cài CueLingo trên macOS để có hỗ trợ đúng lúc, rồi cần ít hỗ trợ hơn vào ngày mai.
            </p>
            <Link href={paths.download} className={styles.primaryAction}>
              Xem cách cài đặt
            </Link>
          </div>
          <div className={styles.closingStage}>
            <CaptionFragment compact />
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.blockMark} aria-label="CueLingo">
            {'CueLingo'.split('').map((letter, i) => (
              <span key={`${letter}-${i}`} aria-hidden="true">
                {letter}
              </span>
            ))}
          </p>
          <div className={styles.footerLinks}>
            <nav aria-label="Điều hướng cuối trang">
              <Link href={paths.download}>Tải ứng dụng</Link>
              {paths.login ? <Link href={paths.login}>Đăng nhập</Link> : null}
            </nav>
            <p>CueLingo cho macOS</p>
          </div>
        </div>
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
