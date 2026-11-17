/** The CueLingo mark: a "C" that opens into two caption lines. */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      role="img"
      aria-label="CueLingo"
      className={className}
    >
      <rect width="256" height="256" rx="58" fill="#0f172a" />
      <path
        d="M167 169.1A64 64 0 1 1 167 86.9"
        fill="none"
        stroke="#fff"
        strokeWidth="26"
        strokeLinecap="round"
      />
      <rect x="124" y="106" width="88" height="16" rx="8" fill="#a5b4fc" />
      <rect x="124" y="134" width="60" height="16" rx="8" fill="#f59e0b" />
    </svg>
  );
}

/** Mark, 12px gap, then the word: the lockup for the sidebar header and auth screens. */
export function LogoLockup({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ''}`}>
      <Logo size={size} />
      <span
        className="text-foreground font-bold tracking-[-0.03em]"
        style={{ fontSize: Math.round(size * 0.56 * 1.4) }}
      >
        CueLingo
      </span>
    </span>
  );
}
