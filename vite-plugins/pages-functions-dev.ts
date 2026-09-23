import type { Connect, Plugin, ViteDevServer } from 'vite';

/**
 * Serves the Cloudflare Pages Functions in `functions/api/*` from the Vite dev
 * server, so `npm run dev` exercises the same handler code that runs on the
 * edge in production. No duplicated proxy logic.
 *
 * Responses are cached in memory for the `s-maxage` the handler itself asks
 * for. In production Cloudflare does this, which is what keeps upstream traffic
 * to roughly one request per hour however many people are watching. Without it
 * every dev reload is a fresh upstream hit, and CelesTrak will — reasonably —
 * start returning 403 to a machine that refetches the same elements hundreds of
 * times an hour.
 */
export function pagesFunctionsDev(): Plugin {
  return {
    name: 'orbital-watch:pages-functions-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api', createApiMiddleware(server));
    },
  };
}

type CachedResponse = {
  status: number;
  headers: [string, string][];
  body: string;
  expiresAt: number;
};

function createApiMiddleware(server: ViteDevServer): Connect.NextHandleFunction {
  const cache = new Map<string, CachedResponse>();

  return async (req, res, next) => {
    const url = req.url ?? '/';
    const route = url.split('?')[0].replace(/^\/|\/$/g, '');
    if (!route) return next();

    const send = (entry: CachedResponse, hit: boolean) => {
      res.statusCode = entry.status;
      for (const [key, value] of entry.headers) res.setHeader(key, value);
      res.setHeader('X-Dev-Cache', hit ? 'HIT' : 'MISS');
      res.end(entry.body);
    };

    const cached = cache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      send(cached, true);
      return;
    }

    try {
      const mod = await server.ssrLoadModule(`/functions/api/${route}.ts`);
      const handler = mod.onRequestGet as
        | ((ctx: { request: Request }) => Promise<Response>)
        | undefined;
      if (!handler) return next();

      const request = new Request(new URL(url, 'http://localhost').toString(), {
        method: req.method ?? 'GET',
      });
      const response = await handler({ request });

      const entry: CachedResponse = {
        status: response.status,
        headers: [...response.headers.entries()],
        body: await response.text(),
        expiresAt: Date.now() + cacheTtlMs(response.headers.get('Cache-Control')),
      };

      // Never cache a failure: a transient upstream error should not stick
      // around for the next hour of development.
      if (response.ok && entry.expiresAt > Date.now()) cache.set(url, entry);

      send(entry, false);
    } catch (error) {
      server.config.logger.error(`[api/${route}] ${String(error)}`);
      next();
    }
  };
}

/** Reads `s-maxage` (the shared-cache directive the edge honours) in ms. */
function cacheTtlMs(cacheControl: string | null): number {
  const seconds = cacheControl?.match(/s-maxage=(\d+)/)?.[1];
  return seconds ? Number(seconds) * 1000 : 0;
}
