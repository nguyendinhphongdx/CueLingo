import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'CueLingo Docs',
  tagline: 'Giao tiếp trong cuộc họp hôm nay, cần ít hỗ trợ hơn vào ngày mai',
  url: 'https://docs.cuelingo.local',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'warn',
  i18n: { defaultLocale: 'vi', locales: ['vi'] },
  markdown: {
    // .md = CommonMark (no MDX surprises with `<x>` and `{}`), .mdx = MDX.
    format: 'detect',
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: 'throw' },
  },
  themes: ['@docusaurus/theme-mermaid'],
  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          showLastUpdateTime: false,
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: 'CueLingo',
      items: [
        { to: '/overview/big-picture', label: 'Toàn cảnh', position: 'left' },
        { to: '/product/features', label: 'Sản phẩm', position: 'left' },
        { to: '/architecture/realtime-pipeline', label: 'Kiến trúc', position: 'left' },
        { to: '/modules', label: 'Modules', position: 'left' },
        { to: '/engineering', label: 'Engineering', position: 'left' },
        { to: '/adr', label: 'ADR', position: 'right' },
      ],
    },
    docs: { sidebar: { hideable: true } },
    tableOfContents: { maxHeadingLevel: 3 },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'sql', 'swift', 'rust'],
    },
    mermaid: { theme: { light: 'neutral', dark: 'dark' } },
  } satisfies Preset.ThemeConfig,
};

export default config;
