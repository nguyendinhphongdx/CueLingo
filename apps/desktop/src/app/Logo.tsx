import logoUrl from '../assets/logo.svg';

export const APP_NAME = 'CueLingo';
export const APP_TAGLINE = 'Trợ lý caption song ngữ cho cuộc họp tiếng Anh';
export const APP_VERSION = '0.1.0';

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <img src={logoUrl} width={size} height={size} alt="" className="rounded-[22%] shadow-sm" />
  );
}
