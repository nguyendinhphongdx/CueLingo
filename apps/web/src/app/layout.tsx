import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@cuelingo/ui/globals.css';
import '@cuelingo/ui/brand.css';
import { ColorScheme } from './color-scheme';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'CueLingo',
  description: 'Giao tiếp trong cuộc họp hôm nay, cần ít hỗ trợ hơn vào ngày mai',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <ColorScheme />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
