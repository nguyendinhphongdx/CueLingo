/**
 * Architecture rules enforced by `pnpm check:deps`.
 * Source of truth for the rules: apps/docs/docs/01-overview/04-system-overview.md (Quy tắc phụ thuộc).
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'apps-not-to-services',
      comment: 'apps/* gọi backend qua @cuelingo/core-sdk, không import code của services/*.',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^services/' },
    },
    {
      name: 'services-not-to-apps',
      severity: 'error',
      from: { path: '^services/' },
      to: { path: '^apps/' },
    },
    {
      name: 'packages-not-to-apps-or-services',
      comment: 'packages/* là thư viện dùng chung, không phụ thuộc app hay service.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^(apps|services)/' },
    },
    {
      name: 'shared-is-a-leaf',
      comment: '@cuelingo/shared không phụ thuộc package nội bộ nào khác.',
      severity: 'error',
      from: { path: '^packages/shared/' },
      to: { path: '^packages/(?!shared/)' },
    },
    {
      name: 'learner-model-is-pure',
      comment: '@cuelingo/learner-model là logic thuần: không I/O, không DB, không mạng.',
      severity: 'error',
      from: { path: '^packages/learner-model/' },
      to: {
        dependencyTypes: ['core', 'npm'],
        path: '^(node:)?(fs|net|http|https|child_process|worker_threads|dgram|dns)$|(^|/)node_modules/(postgres|pg|pg-boss|ioredis|fastify)/',
      },
    },
    {
      name: 'agent-has-no-io',
      comment:
        '@cuelingo/agent là harness không I/O (ADR 0018): không fs, mạng, DB, SDK AI, và không import gateway/prompts/client. Mô hình và công cụ được tiêm vào; chỉ dùng @cuelingo/shared và zod.',
      severity: 'error',
      from: { path: '^packages/agent/' },
      to: {
        path: '^(node:)?(fs|fs/promises|net|tls|http|https|http2|child_process|worker_threads|dgram|dns|dns/promises)$|(^|/)node_modules/(postgres|pg|pg-boss|ioredis|fastify|ai|@ai-sdk/google)/|^packages/(ai-gateway|prompts|core-sdk|learner-model|ui)/',
      },
    },
    {
      name: 'api-modules-via-index',
      comment: 'Module trong services/api chỉ gọi module khác qua index.ts của nó.',
      severity: 'error',
      from: { path: '^services/api/src/modules/([^/]+)/' },
      to: {
        path: '^services/api/src/modules/([^/]+)/(?!index\\.ts$)',
        pathNot: '^services/api/src/modules/$1/',
      },
    },
    {
      name: 'web-features-via-index',
      comment: 'Feature trong apps/web chỉ gọi feature khác qua index.ts của nó.',
      severity: 'error',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: {
        path: '^apps/web/src/features/([^/]+)/(?!index\\.tsx?$)',
        pathNot: '^apps/web/src/features/$1/',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: '(^|/)(dist|\\.next|\\.turbo|\\.docusaurus|build)/|^apps/docs/|^apps/web/out/',
    },
    tsConfig: { fileName: 'tsconfig.base.json' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    preserveSymlinks: false,
  },
};
