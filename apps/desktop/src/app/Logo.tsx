import { Logo as BrandLogo } from '@cuelingo/ui/components/logo';

export const APP_NAME = 'CueLingo';
export const APP_TAGLINE = 'Trợ lý caption song ngữ cho cuộc họp tiếng Anh';
export const APP_VERSION = '0.1.0';

export function Logo({ size = 36 }: { size?: number }) {
  return <BrandLogo size={size} className="rounded-[22%]" />;
}
