/**
 * GET /api/tle
 *
 * Returns current orbital elements for every tracked satellite in one response.
 *
 * Three things keep CelesTrak happy, and all three matter:
 *
 * 1. **The edge actually caches this.** A `Cache-Control` header alone does not
 *    make Cloudflare store a Worker's response — dynamic responses are only
 *    cached if you put them in the Cache API yourself. Without this the origin
 *    would be hit on essentially every page load.
 * 2. **One response covers both satellites,** so switching satellites in the UI
 *    costs no upstream request at all.
 * 3. **Six-hour TTL.** CelesTrak refreshes these files every two hours at most,
 *    and blocks clients that re-download faster than the data changes.
 *
 * CelesTrak is a single slow origin, so upstream failures are a question of
 * when, not if — a Worker subrequest that cannot reach it surfaces as a
 * Cloudflare 522. Two things absorb that: transient statuses are retried, and a
 * separate long-lived copy of the last good response is kept purely so an
 * outage has something accurate to serve. Elements hours or even days old still
 * propagate fine, so serving them beats serving an error.
 */
import { TLE_CACHE_SECONDS, TRACKED_SATELLITES } from '../../shared/catalogue';

const CELESTRAK_GP = 'https://celestrak.org/NORAD/elements/gp.php';

/** What clients are served, and how long before we ask CelesTrak again. */
const FRESH_KEY = 'https://orbital-watch.internal/tle/fresh';

/**
 * Last known good elements. Held far longer than they are normally served,
 * because its only job is to cover an upstream outage.
 */
const FALLBACK_KEY = 'https://orbital-watch.internal/tle/last-known-good';
const FALLBACK_TTL_SECONDS = 7 * 24 * 60 * 60;

/** How long to sit on a stale answer before trying CelesTrak again. */
const RETRY_AFTER_OUTAGE_SECONDS = 300;

/** Cloudflare's own origin-unreachable codes (520-524) sit alongside the usual 5xx. */
const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const RETRY_BACKOFF_MS = [300, 900];
const UPSTREAM_TIMEOUT_MS = 8000;

type Ctx = {
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
};

type TleRecord = { name: string; line1: string; line2: string };

export async function onRequestGet({ waitUntil }: Ctx): Promise<Response> {
  const cache = edgeCache();

  const cached = await cache?.match(FRESH_KEY);
  if (cached) return cached;

  try {
    const body = {
      satellites: await fetchAll(),
      fetchedAt: new Date().toISOString(),
    };

    const fresh = json(
      body,
      200,
      `public, s-maxage=${TLE_CACHE_SECONDS}, stale-while-revalidate=${TLE_CACHE_SECONDS}`,
    );

    if (cache) {
      const writes = Promise.all([
        cache.put(FRESH_KEY, fresh.clone()),
        cache.put(
          FALLBACK_KEY,
          json(body, 200, `public, s-maxage=${FALLBACK_TTL_SECONDS}`),
        ),
      ]);
      if (waitUntil) waitUntil(writes);
      else await writes;
    }

    return fresh;
  } catch (cause) {
    const stale = await cache?.match(FALLBACK_KEY);
    if (!stale) return json({ error: describe(cause) }, 502, 'no-store');

    const served = new Response(stale.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Short, so the outage is re-tested soon, but not zero — otherwise
        // every request during an outage becomes another upstream attempt.
        'Cache-Control': `public, s-maxage=${RETRY_AFTER_OUTAGE_SECONDS}`,
        'X-Orbital-Watch-Stale': 'true',
      },
    });

    if (cache) {
      const write = cache.put(FRESH_KEY, served.clone());
      if (waitUntil) waitUntil(write);
      else await write;
    }

    return served;
  }
}

async function fetchAll(): Promise<Record<string, TleRecord>> {
  const entries = await Promise.all(
    TRACKED_SATELLITES.map(async (satellite) => {
      const url = new URL(CELESTRAK_GP);
      url.searchParams.set('CATNR', String(satellite.catalogNumber));
      url.searchParams.set('FORMAT', 'TLE');

      const text = (await fetchWithRetry(url, satellite.label)).trim();
      if (!text || text.startsWith('No GP data found')) {
        throw new Error(`No orbital data found for ${satellite.label}.`);
      }

      return [satellite.id, parseTle(text, satellite.label)] as const;
    }),
  );

  return Object.fromEntries(entries);
}

/**
 * Fetches one element set, retrying the failures that are worth retrying.
 *
 * Note there is deliberately no `cf: { cacheTtl }` here. That option caches the
 * subrequest whatever its status, so a single 522 would be pinned for hours —
 * exactly the wrong failure mode. Caching is handled above, where only
 * successful responses are ever stored.
 */
async function fetchWithRetry(url: URL, label: string): Promise<string> {
  let lastFailure = `CelesTrak could not be reached for ${label}.`;

  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length + 1; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/plain' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (response.ok) return await response.text();

      lastFailure = `CelesTrak responded ${response.status} for ${label}.`;
      if (!RETRYABLE_STATUS.has(response.status)) break;
    } catch (cause) {
      lastFailure =
        cause instanceof Error && cause.name === 'TimeoutError'
          ? `CelesTrak timed out for ${label}.`
          : `CelesTrak could not be reached for ${label}.`;
    }

    const backoff = RETRY_BACKOFF_MS[attempt];
    if (backoff === undefined) break;
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }

  throw new Error(lastFailure);
}

/** Pulls the name and the two element lines out of a CelesTrak TLE listing. */
function parseTle(text: string, label: string): TleRecord {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const index = lines.findIndex((line) => line.startsWith('1 '));
  const line1 = lines[index];
  const line2 = lines[index + 1];

  if (!line1 || !line2?.startsWith('2 ')) {
    throw new Error(`Malformed TLE received for ${label}.`);
  }

  return { name: lines[index - 1] ?? label, line1, line2 };
}

/** The Workers cache, when running on the edge. Absent in the dev bridge. */
function edgeCache(): Cache | undefined {
  return typeof caches !== 'undefined' ? caches.default : undefined;
}

function describe(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);

  if (message.includes('403')) {
    return 'CelesTrak is rate limiting this deployment. Elements will return once it clears.';
  }

  if (/5\d\d|timed out|could not be reached/.test(message)) {
    return 'CelesTrak is temporarily unreachable and no recent elements are cached.';
  }

  return message;
}

function json(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });
}
