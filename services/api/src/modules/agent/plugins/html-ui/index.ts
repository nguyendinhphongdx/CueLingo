import { defineTool, type AgentPermission, type AgentPlugin } from '@cuelingo/agent';
import { HtmlSourceSchema, type AgentCard } from '@cuelingo/shared';
import { z } from 'zod';
import { checkHtml } from './check';

export const HTML_UI_PLUGIN_ID = 'html-ui';
export const HTML_UI_PERMISSIONS: AgentPermission[] = ['html'];

/** The plugin reaches no service: the page it makes only runs in the user's browser sandbox. */
type NoCapabilities = unknown;

interface RenderHtmlOutput {
  rendered: boolean;
  title?: string;
  html?: string;
  problem?: string;
}

const renderHtml = defineTool<NoCapabilities, { html: string; title?: string }, RenderHtmlOutput>({
  name: 'render_html',
  description:
    'Show the user a small interactive page you wrote: one self-contained HTML document or fragment with inline CSS and JavaScript, ' +
    'at most 64 KB, no network and no external URLs. The user sees it in a locked sandbox. ' +
    'Use it only when show_card and Markdown cannot do the job. The result only says whether it was shown; do not repeat the code.',
  kind: 'read',
  // The size is checked in `run` so the model is told what is wrong; a schema error would only say "invalid input".
  input: z.object({ html: z.string().min(1), title: z.string().trim().min(1).max(120).optional() }),
  output: z.object({
    rendered: z.boolean(),
    title: z.string().max(120).optional(),
    html: HtmlSourceSchema.optional(),
    problem: z.string().max(200).optional(),
  }),
  async run(input) {
    const checked = checkHtml(input.html);
    if (!checked.ok) return { rendered: false, problem: checked.problem.slice(0, 200) };
    return { rendered: true, ...(input.title ? { title: input.title } : {}), html: input.html };
  },
  toCard: (output): AgentCard | undefined =>
    output.rendered && output.html
      ? {
          kind: 'html_block',
          data: { ...(output.title ? { title: output.title } : {}), html: output.html },
        }
      : undefined,
  // The page goes to the card only. The model gets the verdict, never its own code back (no echo, no extra tokens).
  forModel: ({ rendered, title, problem }) => ({
    rendered,
    ...(title ? { title } : {}),
    ...(problem ? { problem } : {}),
  }),
  summarize: (output) =>
    output.rendered ? 'Đã tạo khối giao diện' : 'Chưa tạo được khối giao diện',
});

/**
 * Third plugin: interactive pages for the sandbox runner (ADR 0019, layer 2). The composition root adds it only
 * when `AGENT_HTML_BLOCKS` is on; the agent core and the other plugins do not know it exists.
 */
export const htmlUiPlugin: AgentPlugin<NoCapabilities> = {
  id: HTML_UI_PLUGIN_ID,
  version: '1.0.0',
  permissions: HTML_UI_PERMISSIONS,
  tools: [renderHtml],
  cardKinds: ['html_block'],
};
