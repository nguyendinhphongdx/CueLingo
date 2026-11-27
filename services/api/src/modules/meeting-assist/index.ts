/**
 * Meeting assistant — one question asked during a meeting: consent, fixed-rule retrieval, one streamed model
 * call with checked source labels, and the stored question (ADR 0027).
 * Design: apps/docs/docs/04-modules/03-api/meeting-assist.md
 */
import type { AiGateway } from '@cuelingo/ai-gateway';
import { meetingAssistRoutes } from './meeting-assist.routes';
import {
  createMeetingAssistService,
  type MeetingAssistServiceDeps,
} from './meeting-assist.service';

export interface MeetingAssistDeps {
  /** False refuses questions with 503 (env `MEETING_ASSIST_ENABLED`, or no AI key). */
  enabled: boolean;
  gateway?: Pick<AiGateway, 'ask'>;
}

export type MeetingAssistWiring = Omit<MeetingAssistServiceDeps, 'enabled' | 'gateway'>;

export function createMeetingAssistModule(
  deps: MeetingAssistDeps | undefined,
  wiring: MeetingAssistWiring,
) {
  const service = createMeetingAssistService({
    ...wiring,
    enabled: deps?.enabled ?? false,
    gateway: deps?.gateway,
  });
  return { service, routes: meetingAssistRoutes(service) };
}

export type { MeetingAssistRepository } from './meeting-assist.repository';
export type { MeetingAssistService } from './meeting-assist.service';
export { createPostgresMeetingAssistRepository } from './meeting-assist.repository';
export {
  createInMemoryMeetingAssistRepository,
  type InMemoryMeetingAssistRepository,
} from './meeting-assist.repository.memory';
