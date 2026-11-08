import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/target/**',
      'ml/**',
      '**/.docusaurus/**',
      '.worktrees/**',
      '.claude/skills/**',
      '.taste-skill/**',
      'apps/docs/build/**',
      'apps/web/out/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Every AI call goes through @cuelingo/ai-gateway (docs/05-engineering/ai-calls.md).
    files: ['**/*.{ts,tsx}'],
    ignores: ['packages/ai-gateway/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'openai',
                '@anthropic-ai/*',
                '@google/genai',
                '@google/generative-ai',
                'groq-sdk',
                '@deepgram/*',
                'assemblyai',
              ],
              message:
                'Gọi model AI qua @cuelingo/ai-gateway, không import SDK nhà cung cấp trực tiếp.',
            },
          ],
        },
      ],
    },
  },
);
