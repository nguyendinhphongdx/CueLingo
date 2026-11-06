import { describe, expect, it } from 'vitest';
import { agentFixtures, agentV2Fixtures } from './fixtures/cases';
import { AGENT_PROMPT_VERSION, buildAgentPrompt } from './v1';
import { AGENT_V2_PROMPT_VERSION, agentPromptFor, buildAgentPromptV2 } from './v2';

describe('agent.chat v2', () => {
  it('is versioned and keeps everything v1 says', () => {
    expect(AGENT_V2_PROMPT_VERSION).toBe('agent.chat@v2');
    const { system } = buildAgentPromptV2({ language: 'en' });
    expect(system.startsWith(buildAgentPrompt({ language: 'en' }).system)).toBe(true);
  });

  it('names render_html and limits it to what cards cannot do', () => {
    const { system } = buildAgentPromptV2({ language: 'en' });
    expect(system).toContain('render_html');
    expect(system).toContain('no card kind covers');
    expect(system).toContain('at most 64 KB');
  });

  it('forbids network and external resources, and says the page runs in a sandbox', () => {
    const { system } = buildAgentPromptV2({ language: 'en' });
    for (const banned of ['fetch', 'XMLHttpRequest', 'WebSocket', 'import()', 'sendBeacon'])
      expect(system).toContain(banned);
    expect(system).toContain('locked sandbox');
    expect(system).toContain('Do not load anything from a URL');
  });

  it('lists exactly the host API the runner offers', () => {
    const { system } = buildAgentPromptV2({ language: 'en' });
    for (const call of ['listPhrases()', 'savePhrase(', 'speak(text)', 'resize(height)'])
      expect(system).toContain(call);
    expect(system).toContain('asks the user to confirm');
  });

  it('is chosen by the flag, and v1 is the default without it', () => {
    expect(agentPromptFor(true, { language: 'en' }).version).toBe(AGENT_V2_PROMPT_VERSION);
    const off = agentPromptFor(false, { language: 'en' });
    expect(off.version).toBe(AGENT_PROMPT_VERSION);
    expect(off.system).not.toContain('render_html');
  });

  it('ships fixtures accepted by the prompt builder', () => {
    expect(agentV2Fixtures.length).toBeGreaterThanOrEqual(3);
    for (const fixture of [...agentFixtures, ...agentV2Fixtures])
      expect(() => buildAgentPromptV2(fixture.input)).not.toThrow();
  });
});
