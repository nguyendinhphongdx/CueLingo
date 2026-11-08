import styles from './landing.module.css';

/**
 * Fragments of the CueLingo interface, drawn in HTML. They are pictures of the product (sample text, not data):
 * the window root carries `data-ui` so it keeps its own interface look, and each has a text alternative.
 */

function Bar({ status }: { status: string }) {
  return (
    <div className={styles.windowBar} aria-hidden="true">
      <span className={styles.windowDots}>
        <span />
        <span />
        <span />
      </span>
      <span>CueLingo</span>
      <span className={styles.windowStatus}>
        <span className={styles.liveDot} />
        {status}
      </span>
    </div>
  );
}

/** Live bilingual captions over a meeting. */
export function CaptionFragment({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`${styles.window} ${compact ? styles.windowCompact : ''}`}
      role="img"
      aria-label="Caption song ngữ của CueLingo: câu tiếng Anh của đồng nghiệp kèm bản dịch tiếng Việt"
      data-ui
    >
      <Bar status="Đang nghe · Anh → Việt" />
      <div className={styles.windowBody}>
        <div className={styles.line}>
          <span className={styles.speaker}>Họ</span>
          <p className={styles.english}>Let&apos;s align on the launch plan before Friday.</p>
          <p className={styles.vietnamese}>Mình thống nhất kế hoạch ra mắt trước thứ Sáu nhé.</p>
        </div>
        {compact ? null : (
          <div className={styles.line}>
            <span className={`${styles.speaker} ${styles.speakerYou}`}>Bạn</span>
            <p className={styles.english}>Sounds good. I will send the draft tomorrow.</p>
            <p className={styles.vietnamese}>Được đó. Mai mình gửi bản nháp.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Looking up a word that was just heard. */
export function LookupFragment() {
  return (
    <div
      className={styles.window}
      role="img"
      aria-label="Tra nhanh cụm từ vừa nghe trong CueLingo: align on nghĩa là thống nhất về"
      data-ui
    >
      <Bar status="Tra từ" />
      <div className={styles.windowBody}>
        <div className={styles.line}>
          <p className={styles.english}>
            Let&apos;s <span className={styles.term}>align on</span> the launch plan.
          </p>
        </div>
        <div className={styles.line}>
          <p className={styles.vietnamese}>align on</p>
          <p className={styles.english}>thống nhất về · đi đến đồng thuận về</p>
          <div className={styles.chips}>
            <span className={`${styles.chip} ${styles.chipOn}`}>Lưu để ôn</span>
            <span className={styles.chip}>Nghe lại</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Asking the assistant in the middle of a meeting. */
export function AskFragment() {
  return (
    <div
      className={styles.window}
      role="img"
      aria-label="Trợ lý của CueLingo trả lời câu hỏi ngay trong cuộc họp, ví dụ tóm tắt đoạn vừa nghe"
      data-ui
    >
      <Bar status="Trợ lý" />
      <div className={styles.windowBody}>
        <div className={styles.line}>
          <span className={`${styles.speaker} ${styles.speakerYou}`}>Bạn</span>
          <p className={styles.vietnamese}>Tóm tắt 2 phút vừa rồi giúp mình.</p>
        </div>
        <div className={styles.line}>
          <span className={styles.speaker}>Trợ lý</span>
          <p className={styles.english}>
            Nhóm chốt ra mắt trước thứ Sáu. Bạn cần gửi bản nháp vào ngày mai.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Reviewing a phrase that came up in a real meeting. */
export function ReviewFragment() {
  return (
    <div
      className={styles.window}
      role="img"
      aria-label="Thẻ ôn tập của CueLingo: cụm từ align on lấy từ chính cuộc họp của bạn"
      data-ui
    >
      <Bar status="Ôn tập" />
      <div className={styles.windowBody}>
        <div className={styles.line}>
          <p className={styles.english}>Từ cuộc họp hôm qua</p>
          <p className={styles.vietnamese}>
            We should <span className={styles.term}>align on</span> the plan.
          </p>
        </div>
        <div className={styles.chips}>
          <span className={styles.chip}>Chưa nhớ</span>
          <span className={styles.chip}>Hơi nhớ</span>
          <span className={`${styles.chip} ${styles.chipOn}`}>Nhớ rồi</span>
        </div>
      </div>
    </div>
  );
}

/** The summary after a meeting: what was decided and which phrases are worth reviewing. */
export function DebriefFragment() {
  return (
    <div
      className={styles.window}
      role="img"
      aria-label="Debrief của CueLingo sau cuộc họp: các điểm đã chốt và cụm từ nên ôn"
      data-ui
    >
      <Bar status="Debrief" />
      <div className={styles.windowBody}>
        <div className={styles.line}>
          <p className={styles.vietnamese}>Họp kế hoạch ra mắt</p>
          <p className={styles.english}>Chốt ra mắt trước thứ Sáu · Bạn gửi bản nháp ngày mai</p>
        </div>
        <div className={styles.chips}>
          <span className={`${styles.chip} ${styles.chipOn}`}>align on</span>
          <span className={styles.chip}>launch plan</span>
          <span className={styles.chip}>draft</span>
        </div>
      </div>
    </div>
  );
}
