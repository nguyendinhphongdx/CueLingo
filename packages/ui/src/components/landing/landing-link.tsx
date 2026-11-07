import type { ComponentType, ReactNode } from 'react';

/** Props every landing page passes to its link component, so the host app can bring its own router link. */
export type LandingLinkProps = {
  href: string;
  className?: string;
  'aria-label'?: string;
  children: ReactNode;
};

/** A link component such as `next/link`; defaults to a plain anchor for static hosts. */
export type LandingLink = ComponentType<LandingLinkProps>;

/**
 * Where the landing pages point. `login` is null on hosts without sign-in (the static site), which hides
 * every sign-in link.
 */
export type LandingPaths = {
  home: string;
  download: string;
  login: string | null;
};

export const DEFAULT_LANDING_PATHS: LandingPaths = {
  home: '/',
  download: '/download',
  login: '/login',
};

export function PlainLink({ href, className, children, ...rest }: LandingLinkProps) {
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  );
}
