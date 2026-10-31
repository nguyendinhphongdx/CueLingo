/**
 * Glossary module — REFERENCE MODULE for services/api. Copy this folder's structure for new modules.
 * Design: apps/docs/docs/04-modules/03-api/glossary.md · Convention: apps/docs/docs/05-engineering/conventions/api-module.md
 */
import { glossaryRoutes } from './glossary.routes';
import { createGlossaryService } from './glossary.service';
import type { GlossaryRepository } from './glossary.repository';

export function createGlossaryModule(repo: GlossaryRepository) {
  const service = createGlossaryService(repo);
  return { service, routes: glossaryRoutes(service) };
}

export type { GlossaryRepository } from './glossary.repository';
export type { GlossaryService } from './glossary.service';
export { createPostgresGlossaryRepository } from './glossary.repository';
export { createInMemoryGlossaryRepository } from './glossary.repository.memory';
