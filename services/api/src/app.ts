import { randomUUID } from 'node:crypto';
import {
  resolvePlanLimits,
  resolvePlanPrices,
  type PlanLimitTable,
  type PlanPriceTable,
} from '@cuelingo/shared';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyServerOptions,
} from 'fastify';
import { registerAuth, type AuthOptions } from './lib/auth';
import { registerErrorHandler } from './lib/errors';
import type { JobQueue } from './lib/queue';
import { createAgentModule, type AgentDeps, type AgentRepository } from './modules/agent';
import { createAssistModule, type AssistDeps } from './modules/assist';
import { createTtsModule, type TtsDeps } from './modules/tts';
import { createDebriefModule, type DebriefRepository } from './modules/debrief';
import { createEventsModule, type EventsRepository } from './modules/events';
import { createDialModule, type DialRepository } from './modules/dial';
import { createPlacementModule, type PlacementRepository } from './modules/placement';
import { createAccountModule, type AccountRepository } from './modules/account';
import { createDeviceModule, type DeviceRepository } from './modules/device';
import { createFollowupModule, type FollowupDeps } from './modules/followup';
import { createConversationsModule, type ConversationsRepository } from './modules/conversations';
import { createCoursesModule, type CoursesRepository } from './modules/courses';
import { createGlossaryModule, type GlossaryRepository } from './modules/glossary';
import {
  createMeetingAssistModule,
  type MeetingAssistDeps,
  type MeetingAssistRepository,
} from './modules/meeting-assist';
import { createGoalsModule, type GoalsDeps, type GoalsRepository } from './modules/goals';
import { createPrivacyModule, type PrivacyRepository } from './modules/privacy';
import { createRealtimeModule, type RealtimeDeps } from './modules/realtime';
import {
  createReviewModule,
  createStudyModule,
  type PhrasesRepository,
  type StudyRepository,
} from './modules/review';
import { createSpeakersModule, type SpeakersRepository } from './modules/speakers';
import { createSessionsModule, type SessionsRepository } from './modules/sessions';
import {
  createAdminAnalyticsModule,
  type AdminAnalyticsRepository,
} from './modules/admin-analytics';
import { createAdminUsersModule, type AdminUsersRepository } from './modules/admin-users';
import { createAdminModule, type AdminRepository, type AgentAdminPort } from './modules/admin';
import { createFeedbackModule, type FeedbackRepository } from './modules/feedback';
import { createInvitesModule, type InvitesRepository } from './modules/invites';
import {
  createBillingModule,
  type BillingRepository,
  type PaymentProvider,
} from './modules/billing';
import { createUsageModule, type UsageRepository } from './modules/usage';
import { createTranscribeModule, type TranscribeDeps } from './modules/transcribe';
import { createSettingsModule, type SettingsRepository } from './modules/settings';

/** Origins of the desktop webview (bundled app, Windows bundle, `tauri dev`). It signs in with a bearer token, not cookies. */
const DESKTOP_ORIGINS = ['tauri://localhost', 'http://tauri.localhost', 'http://localhost:1420'];
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;
const LOG_REDACT = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body',
    'res.headers.set-cookie',
    'authorization',
    'body',
    'email',
    '*.email',
    '*.*.email',
    'signature',
    '*.signature',
  ],
  censor: '[Redacted]',
};

export interface AppDeps {
  repos: {
    debrief: DebriefRepository;
    events: EventsRepository;
    glossary: GlossaryRepository;
    courses: CoursesRepository;
    goals: GoalsRepository;
    conversations: ConversationsRepository;
    /** Read model of assistant spend (`ai_call` events) for the daily quota. */
    agent: AgentRepository;
    account: AccountRepository;
    dial: DialRepository;
    placement: PlacementRepository;
    device: DeviceRepository;
    phrases: PhrasesRepository;
    privacy: PrivacyRepository;
    study: StudyRepository;
    sessions: SessionsRepository;
    speakers: SpeakersRepository;
    meetingAssist: MeetingAssistRepository;
    admin: AdminRepository;
    invites: InvitesRepository;
    feedback: FeedbackRepository;
    settings: SettingsRepository;
    usage: UsageRepository;
    billing: BillingRepository;
    adminUsers: AdminUsersRepository;
    adminAnalytics: AdminAnalyticsRepository;
  };
  /** Plan limits (`PLAN_LIMITS`); defaults to the table in `@cuelingo/shared`. */
  planLimits?: PlanLimitTable;
  /** VND prices (`PLAN_PRICES`); defaults to the table in `@cuelingo/shared`. */
  planPrices?: PlanPriceTable;
  /** The payment provider. Omitted = upgrading is off: `GET /v1/billing` says `enabled: false`. */
  paymentProvider?: PaymentProvider;
  /** Clock for plans and billing; tests move it. Defaults to the system clock. */
  now?: () => Date;
  queue: JobQueue;
  resolveUserId: AuthOptions['resolveUserId'];
  /** Origin of apps/web, allowed by CORS (cookies included). */
  webOrigin: string;
  /** Mounts /api/auth/*. Omitted in tests that fake the session. */
  authRoutes?: FastifyPluginAsync;
  /** Enables the live-caption WebSocket route when its provider credentials are available. */
  realtime?: RealtimeDeps;
  /** Mounts the assistant turn route; `enabled: false` makes it answer 503. Needs `assist` for the lookup tool. */
  agent?: AgentDeps;
  /** Enables Quick Assist routes when an AI gateway is available. */
  assist?: AssistDeps;
  /** Enables text to speech when an AI gateway and an audio cache are available. */
  tts?: TtsDeps;
  /** Enables cloud speech recognition for meetings in cloud-recognised languages (ADR 0014). */
  transcribe?: TranscribeDeps;
  /** Enables follow-up drafts from a debrief when an AI gateway is available. */
  followup?: FollowupDeps;
  /** The assistant asked during a meeting (ADR 0027). Omitted or `enabled: false` answers 503. */
  meetingAssist?: MeetingAssistDeps;
  /** Goal lessons: goals always work, making and practising lessons need the gateway (ADR 0025). */
  goals?: GoalsDeps;
  /** Development-only bearer-token verifier for assist and event ingestion. */
  verifyDevToken?: AuthOptions['verifyDevToken'];
  /** False disables logs. Object form is mainly a test seam for an in-memory stream. */
  logger?: FastifyServerOptions['logger'];
  adminEmails?: readonly string[];
  /** Adds `Secure` to the invite cookie. True in production. */
  secureCookies?: boolean;
  /** New accounts need an invite code (`INVITES_REQUIRED`); reported to the login page. */
  invitesRequired?: boolean;
}

/** Composition root: the only place that wires repositories, services and routes together. */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const requestedLogger = deps.logger ?? false;
  const logger =
    requestedLogger && typeof requestedLogger === 'object'
      ? { ...requestedLogger, redact: LOG_REDACT }
      : requestedLogger
        ? { redact: LOG_REDACT }
        : false;
  const app = Fastify({
    logger,
    // Behind the Cloudflare Tunnel every request arrives from cloudflared. Nothing else can reach the API
    // (no published port), so X-Forwarded-* is trusted and request.ip is the real client.
    trustProxy: deps.secureCookies === true,
    // Not `requestIdHeader`: Fastify would take the client's value as is. `genReqId` checks it first.
    requestIdHeader: false,
    genReqId: (request) => {
      const candidate = request.headers['x-request-id'];
      return typeof candidate === 'string' && SAFE_REQUEST_ID.test(candidate)
        ? candidate
        : randomUUID();
    },
  });
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
  if (deps.realtime) await app.register(websocket);
  registerErrorHandler(app);
  // CORS first, so preflight requests are answered before the auth hook runs.
  // @fastify/cors only allows GET, HEAD and POST by default; the glossary needs PATCH and DELETE, the admin screen PUT.
  await app.register(cors, {
    // The desktop app's webview has its own origin: tauri://localhost when bundled, the Vite dev server otherwise.
    origin: [deps.webOrigin, ...DESKTOP_ORIGINS],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  const device = createDeviceModule(deps.repos.device);
  registerAuth(app, {
    resolveUserId: deps.resolveUserId,
    verifyDevToken: deps.verifyDevToken,
    verifyDeviceToken: device.device.verifyToken,
  });

  await app.register(device.routes, { prefix: '/v1/device' });
  await app.register(createAccountModule(deps.repos.account).routes);
  await app.register(createDialModule(deps.repos.dial).routes);
  await app.register(createPlacementModule(deps.repos.placement).routes);
  // The assistant is built further down; the admin screen reaches it through this slot.
  let agentAdmin: AgentAdminPort | undefined;
  const admin = createAdminModule(deps.repos.admin, deps.adminEmails ?? [], () => agentAdmin);
  await app.register(admin.routes, { prefix: '/v1/admin' });
  const planLimits = deps.planLimits ?? resolvePlanLimits();
  const billing = createBillingModule(deps.repos.billing, {
    provider: deps.paymentProvider,
    prices: deps.planPrices ?? resolvePlanPrices(),
    limits: planLimits,
    isAdmin: admin.service.isAdmin,
    webOrigin: deps.webOrigin,
    log: app.log,
    now: deps.now,
  });
  await app.register(billing.routes);
  const usage = createUsageModule(deps.repos.usage, {
    limits: planLimits,
    isAdmin: admin.service.isAdmin,
    // Billing is built first: a plan change by an admin writes the plan and the 0 dong order together.
    grant: billing.service.grantByAdmin,
    now: deps.now,
  });
  await app.register(usage.routes);
  // After billing and usage: it reads plans and orders through their services.
  const adminUsers = createAdminUsersModule(deps.repos.adminUsers, {
    isAdmin: admin.service.isAdmin,
    usage: usage.service,
    billing: billing.service,
    limits: planLimits,
    now: deps.now,
  });
  await app.register(adminUsers.routes);
  // Last of the admin modules: it reuses the dashboard of admin-users and the metrics of admin.
  await app.register(
    createAdminAnalyticsModule(deps.repos.adminAnalytics, {
      isAdmin: admin.service.isAdmin,
      limits: planLimits,
      dashboard: adminUsers.service.dashboard,
      metrics: admin.service.metrics,
      now: deps.now,
    }).routes,
  );
  await app.register(
    createInvitesModule(deps.repos.invites, admin.service.isAdmin, {
      secureCookie: deps.secureCookies ?? false,
      required: deps.invitesRequired ?? false,
    }).routes,
  );
  app.get('/healthz', async () => ({ ok: true }));
  if (deps.authRoutes) await app.register(deps.authRoutes);
  await app.register(createDebriefModule(deps.repos.debrief, deps.repos.sessions).routes);
  await app.register(createEventsModule(deps.repos.events).routes, { prefix: '/v1/events' });
  await app.register(createFeedbackModule(deps.repos.feedback).routes);
  await app.register(createConversationsModule(deps.repos.conversations).routes, {
    prefix: '/v1/conversations',
  });
  await app.register(createGlossaryModule(deps.repos.glossary).routes, { prefix: '/v1/glossary' });
  await app.register(createPrivacyModule(deps.repos.privacy).routes);
  await app.register(createSettingsModule(deps.repos.settings).routes);
  await app.register(createSessionsModule(deps.repos.sessions, deps.queue, usage.service).routes, {
    prefix: '/v1/sessions',
  });
  await app.register(createSpeakersModule(deps.repos.speakers).routes);
  const review = createReviewModule(deps.repos.phrases);
  await app.register(review.routes, { prefix: '/v1/phrases' });
  const study = createStudyModule(deps.repos.study);
  await app.register(study.reviewRoutes, { prefix: '/v1/review' });
  await app.register(study.progressRoutes, { prefix: '/v1/progress' });
  await app.register(
    createCoursesModule(deps.repos.courses, {
      listItems: deps.repos.study.listItems,
      savePhrase: review.phrases.save,
    }).routes,
    { prefix: '/v1/courses' },
  );
  await app.register(
    createGoalsModule(
      deps.repos.goals,
      {
        usage: usage.service,
        listItems: deps.repos.study.listItems,
        savePhrase: review.phrases.save,
        answer: study.study.answer,
        async listTerms(userId, language) {
          const glossary = await deps.repos.glossary.list(userId, language);
          const phrases = await review.phrases.list(userId, language);
          return [
            ...glossary.map(({ term, translation }) => ({ term, translation })),
            ...phrases.map(({ phrase, meaningVi }) => ({ term: phrase, translation: meaningVi })),
          ];
        },
      },
      deps.goals,
    ).routes,
    { prefix: '/v1/goals' },
  );
  if (deps.transcribe) {
    await app.register(
      createTranscribeModule(deps.repos.sessions, usage.service, deps.transcribe).routes,
    );
  }
  if (deps.followup) {
    await app.register(
      createFollowupModule(deps.repos.sessions, deps.repos.debrief, deps.followup).routes,
    );
  }
  if (deps.tts) {
    const getVoice = async (userId: string) => (await deps.repos.settings.voice(userId)) ?? null;
    await app.register(createTtsModule({ getVoice, ...deps.tts }).routes, { prefix: '/v1/tts' });
  }
  const assist = deps.assist ? createAssistModule(deps.assist, usage.service) : undefined;
  if (assist) await app.register(assist.routes, { prefix: '/v1/assist' });
  if (deps.agent) {
    const agent = createAgentModule(deps.agent, {
      conversations: deps.repos.conversations,
      usage: deps.repos.agent,
      plan: usage.service,
      lookup: assist?.service.lookup,
      phrases: { list: review.phrases.list, save: review.phrases.save },
    });
    agentAdmin = agent.service.admin;
    await app.register(agent.routes, { prefix: '/v1/conversations' });
  }
  // Always mounted: a client asks whether the assistant is on, and a person can always withdraw consent.
  await app.register(
    createMeetingAssistModule(deps.meetingAssist, {
      repo: deps.repos.meetingAssist,
      sessions: deps.repos.sessions,
      usage: usage.service,
      listGlossary: (userId, language) => deps.repos.glossary.list(userId, language),
      listPhrases: (userId, language) => review.phrases.list(userId, language),
      now: deps.now,
    }).routes,
  );
  if (deps.realtime) await app.register(createRealtimeModule(deps.realtime, usage.service).routes);

  return app;
}
