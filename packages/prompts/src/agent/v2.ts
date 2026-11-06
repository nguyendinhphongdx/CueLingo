import { AGENT_PROMPT_VERSION, buildAgentPrompt, type AgentPromptInput } from './v1';

export const AGENT_V2_PROMPT_VERSION = 'agent.chat@v2';

/**
 * What v2 adds to v1: the tool `render_html` (plugin `html-ui`, ADR 0019 layer 2) and the small API the page
 * can call. The page runs in a sandbox, so the rules are written as limits the model must respect, not as
 * advice: a page that breaks them is stopped.
 */
const HTML_RULES = [
  'Interactive page: besides cards you can call render_html to show a small page of your own, but only when the user asks for something interactive that no card kind covers (a mini game, a timer, a custom drill). Prefer show_card or plain Markdown whenever they are enough.',
  'render_html takes {title?, html}. html is ONE self-contained document or fragment with inline CSS and inline JavaScript, at most 64 KB (aim for under 8 KB). It runs in a locked sandbox with no network, no cookies or storage, no popups and no navigation.',
  'Do not use fetch, XMLHttpRequest, WebSocket, EventSource, WebRTC, sendBeacon, import(), importScripts, iframes, objects, <base> or <meta http-equiv>. Do not load anything from a URL (scripts, styles, fonts, images): use inline CSS and data: images only. A page that tries is rejected or stopped.',
  'The page may call window.cuelingo (each returns a Promise): listPhrases() gives up to 50 of the user’s saved phrases as {phrase, meaningVi}; savePhrase({phrase, meaningVi}) asks the user to confirm and may be declined; speak(text) reads text aloud; resize(height) sets the height in pixels (it also resizes by itself). Nothing else about the user is available. Never ask the user for passwords or personal details inside the page.',
  'Write the page text in Vietnamese and the practice material in the language being taught. Make it accessible: real <button> elements, labels, readable contrast, no flashing.',
  'The render_html result only says whether the page was shown. If it reports a problem, fix that one thing and call it again once, or fall back to a card or text. After it succeeds, add at most one short sentence and do not repeat the code.',
];

/**
 * System prompt of the assistant when interactive pages are on (`AGENT_HTML_BLOCKS`): everything in v1 plus the
 * rules for `render_html`. v1 stays untouched so the flag can be turned off without changing behaviour.
 */
export function buildAgentPromptV2(input: AgentPromptInput) {
  const { system } = buildAgentPrompt(input);
  return { system: [system, ...HTML_RULES].join('\n') };
}

/** The prompt to use for a turn: v2 when interactive pages are on, v1 otherwise. */
export function agentPromptFor(htmlBlocks: boolean, input: AgentPromptInput) {
  return htmlBlocks
    ? { version: AGENT_V2_PROMPT_VERSION, ...buildAgentPromptV2(input) }
    : { version: AGENT_PROMPT_VERSION, ...buildAgentPrompt(input) };
}
