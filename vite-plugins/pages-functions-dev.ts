import type { Connect, Plugin, ViteDevServer } from 'vite';

/**
 * Serves the Cloudflare Pages Functions in `functions/api/*` from the Vite dev
 * server, so `npm run dev` exercises the same handler code that runs on the
 * edge in production. No duplicated proxy logic.
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

function createApiMiddleware(server: ViteDevServer): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const route = (req.url ?? '/').split('?')[0].replace(/^\/|\/$/g, '');
    if (!route) return next();

    try {
      const mod = await server.ssrLoadModule(`/functions/api/${route}.ts`);
      const handler = mod.onRequestGet as
        | ((ctx: { request: Request }) => Promise<Response>)
        | undefined;
      if (!handler) return next();

      const request = new Request(
        new URL(req.url ?? '/', 'http://localhost').toString(),
        { method: req.method ?? 'GET' },
      );
      const response = await handler({ request });

      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(await response.text());
    } catch (error) {
      server.config.logger.error(`[api/${route}] ${String(error)}`);
      next();
    }
  };
}
