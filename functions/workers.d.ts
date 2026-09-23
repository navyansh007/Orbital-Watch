/**
 * Cloudflare's Workers runtime extends the standard web platform in two ways we
 * rely on. Neither is in the DOM lib, so they are declared here.
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
