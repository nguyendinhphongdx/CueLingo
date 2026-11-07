import { Logo } from '../logo';
import {
  DEFAULT_LANDING_PATHS,
  PlainLink,
  type LandingLink,
  type LandingPaths,
} from './landing-link';
import styles from './landing.module.css';

export function PublicHeader({
  link: Link = PlainLink,
  paths = DEFAULT_LANDING_PATHS,
}: {
  link?: LandingLink;
  paths?: LandingPaths;
}) {
  return (
    <header className={styles.header}>
      <Link className={styles.brandLink} href={paths.home} aria-label="CueLingo — trang chủ">
        <Logo size={36} className={styles.logo} />
        <span>CueLingo</span>
      </Link>
      <nav className={styles.headerNav} aria-label="Điều hướng công khai">
        <Link href={paths.download}>Tải ứng dụng</Link>
        {paths.login ? <Link href={paths.login}>Đăng nhập</Link> : null}
      </nav>
    </header>
  );
}
