/**
 * Pieces of the Cloudflare Workers runtime that are not in the DOM lib.
 */

interface CacheStorage {
  /** The per-colo cache shared by all Workers on the zone. */
  readonly default: Cache;
}

interface RequestInit {
  /** Cloudflare-specific fetch controls, including subrequest caching. */
  cf?: {
    cacheTtl?: number;
    cacheEverything?: boolean;
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
