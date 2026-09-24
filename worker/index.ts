/**
 * Worker entry point.
 *
 * The runtime matches static assets first, so this only runs for paths that are
 * not files in dist/ — in practice, the two data routes. Anything else is handed
 * straight back to the asset server, which also covers the SPA fallback.
 */
import { onRequestGet as spaceweather } from './api/spaceweather';
import { onRequestGet as tle } from './api/tle';

export type Env = {
  /** Binding to the built static site, configured in wrangler.toml. */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
};

type RouteHandler = (ctx: {
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
}) => Promise<Response>;

const ROUTES: Record<string, RouteHandler> = {
  '/api/tle': tle,
  '/api/spaceweather': spaceweather,
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const handler = ROUTES[new URL(request.url).pathname];

    if (!handler) return env.ASSETS.fetch(request);

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
    }

    // waitUntil lets the TLE route write to the edge cache without holding up
    // the response.
    return handler({ request, waitUntil: ctx.waitUntil.bind(ctx) });
  },
};
