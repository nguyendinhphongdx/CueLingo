import type { LookupRequest } from '@cuelingo/shared';

export const lookupFixtures: { name: string; input: LookupRequest }[] = [
  {
    name: 'term with meeting context',
    input: { term: 'table', context: 'We can table this discussion until the next sprint.' },
  },
  { name: 'business acronym', input: { term: 'SLA', context: 'The SLA expires on Friday.' } },
  { name: 'term without context', input: { term: 'roadmap' } },
];
