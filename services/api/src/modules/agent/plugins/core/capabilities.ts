import type { AgentPermission } from '@cuelingo/agent';
import type { LanguageCode, LookupRequest, LookupResponse, Phrase } from '@cuelingo/shared';

/**
 * What the `core` plugin may do for the signed-in user. A facade, never SQL or a raw `userId`: it is built
 * per turn, bound to the authenticated user and the conversation's language.
 */
export interface CoreCapabilities {
  lookup(input: Pick<LookupRequest, 'term' | 'context'>): Promise<LookupResponse>;
  listPhrases(): Promise<Phrase[]>;
  savePhrase(input: { phrase: string; meaningVi?: string; context?: string }): Promise<Phrase>;
}

/** The services the API has to offer; the facade picks from them by permission. */
export interface CoreServices {
  lookup(userId: string, input: LookupRequest): Promise<LookupResponse>;
  listPhrases(userId: string, language: LanguageCode): Promise<Phrase[]>;
  savePhrase(
    userId: string,
    input: { phrase: string; meaningVi?: string; context?: string; language: LanguageCode },
  ): Promise<Phrase>;
}

const denied = (permission: AgentPermission) => async (): Promise<never> => {
  throw new Error(`permission ${permission} not granted`);
};

export function buildCoreCapabilities(
  services: CoreServices,
  userId: string,
  language: LanguageCode,
  granted: readonly AgentPermission[],
): CoreCapabilities {
  const has = (permission: AgentPermission) => granted.includes(permission);
  return {
    lookup: has('lookup')
      ? (input) => services.lookup(userId, { ...input, language })
      : denied('lookup'),
    listPhrases: has('phrases:read')
      ? () => services.listPhrases(userId, language)
      : denied('phrases:read'),
    savePhrase: has('phrases:write')
      ? (input) => services.savePhrase(userId, { ...input, language })
      : denied('phrases:write'),
  };
}

const PERMISSION_OF: Record<keyof CoreCapabilities, AgentPermission> = {
  lookup: 'lookup',
  listPhrases: 'phrases:read',
  savePhrase: 'phrases:write',
};

/**
 * Narrows the turn's capabilities to what one plugin declared in `permissions` (the registry calls this per tool
 * run), so a plugin cannot reach a service it did not ask for even though the turn carries all of them.
 */
export function scopeCapabilities(
  capabilities: CoreCapabilities,
  granted: readonly AgentPermission[],
): CoreCapabilities {
  const pick = <K extends keyof CoreCapabilities>(key: K): CoreCapabilities[K] =>
    granted.includes(PERMISSION_OF[key])
      ? capabilities[key]
      : (denied(PERMISSION_OF[key]) as CoreCapabilities[K]);
  return {
    lookup: pick('lookup'),
    listPhrases: pick('listPhrases'),
    savePhrase: pick('savePhrase'),
  };
}
