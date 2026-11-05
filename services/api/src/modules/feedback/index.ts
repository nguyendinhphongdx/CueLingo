/**
 * Feedback module — bug reports and ideas from beta testers.
 * Design: apps/docs/docs/04-modules/03-api/feedback.md
 */
import { feedbackRoutes } from './feedback.routes';
import { createFeedbackService } from './feedback.service';
import type { FeedbackRepository } from './feedback.repository';

export function createFeedbackModule(repo: FeedbackRepository) {
  const service = createFeedbackService(repo);
  return { service, routes: feedbackRoutes(service) };
}

export type { FeedbackRepository } from './feedback.repository';
export { createPostgresFeedbackRepository } from './feedback.repository';
export { createInMemoryFeedbackRepository } from './feedback.repository.memory';
