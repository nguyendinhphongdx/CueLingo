import type { ComposeRequest } from '@cuelingo/shared';

export const composeFixtures: { name: string; input: ComposeRequest }[] = [
  { name: 'ask for clarification', input: { intentVi: 'Bạn có thể giải thích rõ hơn không?' } },
  {
    name: 'respond in context',
    input: {
      intentVi: 'Tôi đồng ý nhưng cần thêm một ngày.',
      context: ['Can you finish this by Thursday?'],
    },
  },
  { name: 'polite interruption', input: { intentVi: 'Xin lỗi, cho tôi bổ sung một ý.' } },
];
