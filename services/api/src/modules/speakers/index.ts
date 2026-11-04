/**
 * Speakers module — names for the people of a meeting (rename in the debrief).
 * Design: apps/docs/docs/04-modules/03-api/speakers.md · Convention: apps/docs/docs/05-engineering/conventions/api-module.md
 */
import { speakersRoutes } from './speakers.routes';
import { createSpeakersService } from './speakers.service';
import type { SpeakersRepository } from './speakers.repository';

export function createSpeakersModule(repo: SpeakersRepository) {
  const service = createSpeakersService(repo);
  return { service, routes: speakersRoutes(service) };
}

export type { SpeakersRepository } from './speakers.repository';
export type { SpeakersService } from './speakers.service';
export { createPostgresSpeakersRepository } from './speakers.repository';
export { createInMemorySpeakersRepository } from './speakers.repository.memory';
