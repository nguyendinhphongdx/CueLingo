import {
  GlossaryTermListSchema,
  GlossaryTermSchema,
  type CreateGlossaryTermInput,
  type LanguageCode,
  type GlossaryTerm,
  type UpdateGlossaryTerm,
} from '@cuelingo/shared';
import type { Http } from './http';

export function glossaryApi(http: Http) {
  return {
    /** Terms of one language; the API assumes English when `language` is left out. */
    async list(language?: LanguageCode): Promise<GlossaryTerm[]> {
      const query = language ? `?language=${language}` : '';
      return (await http.request('GET', `/v1/glossary${query}`, GlossaryTermListSchema)).items;
    },
    create(input: CreateGlossaryTermInput): Promise<GlossaryTerm> {
      return http.request('POST', '/v1/glossary', GlossaryTermSchema, input);
    },
    update(id: string, patch: UpdateGlossaryTerm): Promise<GlossaryTerm> {
      return http.request('PATCH', `/v1/glossary/${id}`, GlossaryTermSchema, patch);
    },
    async remove(id: string): Promise<void> {
      await http.request('DELETE', `/v1/glossary/${id}`, null);
    },
  };
}
