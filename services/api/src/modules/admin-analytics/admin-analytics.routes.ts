import type { FastifyPluginAsync } from 'fastify';
import type { AdminAnalyticsService } from './admin-analytics.service';

/**
 * Read-only HTTP surface. Full paths, like admin-users. The service validates every answer against its strict
 * schema, so a stray identifier fails loudly instead of leaving the server.
 */
export function adminAnalyticsRoutes(service: AdminAnalyticsService): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/admin/analytics/overview', async (request) => service.overview(request.userId));
    app.get('/v1/admin/analytics/revenue', async (request) => service.revenue(request.userId));
    app.get('/v1/admin/analytics/usage', async (request) => service.usage(request.userId));
    app.get('/v1/admin/analytics/activity', async (request) => service.activity(request.userId));
  };
}
