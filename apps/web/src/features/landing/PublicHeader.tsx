import { Logo } from '@cuelingo/ui/components/logo';
import Link from 'next/link';
import styles from './landing.module.css';

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link className={styles.brandLink} href="/" aria-label="CueLingo — trang chủ">
        <Logo size={36} className={styles.logo} />
        <span>CueLingo</span>
      </Link>
      <nav className={styles.headerNav} aria-label="Điều hướng công khai">
        <Link href="/download">Tải ứng dụng</Link>
        <Link href="/login">Đăng nhập</Link>
      </nav>
    </header>
  );
}
