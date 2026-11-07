import styles from './landing.module.css';

export function CaptionOverlay({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`${styles.captionScene} ${compact ? styles.captionSceneCompact : ''}`}
      role="img"
      aria-label="Minh hoạ overlay CueLingo dịch lời nói tiếng Anh sang tiếng Việt"
      data-ui
    >
      <div className={styles.meetingChrome} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={styles.captionWindow}>
        <p className={styles.speaker}>Họ</p>
        <p className={styles.english}>Let&apos;s align on the launch plan before Friday.</p>
        <p className={styles.vietnamese}>Mình thống nhất kế hoạch ra mắt trước thứ Sáu nhé.</p>
      </div>
    </div>
  );
}
