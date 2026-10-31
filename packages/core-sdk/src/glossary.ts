import {
  GlossaryTermListSchema,
  GlossaryTermSchema,
  type CreateGlossaryTermInput,
  type GlossaryTerm,
  type UpdateGlossaryTerm,
} from '@cuelingo/shared';
import type { Http } from './http';

export function glossaryApi(http: Http) {
  return {
    async list(): Promise<GlossaryTerm[]> {
      return (await http.request('GET', '/v1/glossary', GlossaryTermListSchema)).items;
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
