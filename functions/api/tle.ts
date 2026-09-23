/**
 * GET /api/tle
 *
 * Returns current orbital elements for every tracked satellite in one response.
 *
 * Three things keep CelesTrak happy, and all three matter:
 *
 * 1. **The edge actually caches this.** A `Cache-Control` header alone does not
 *    make Cloudflare store a Function's response — dynamic responses are only
 *    cached if you put them in the Cache API yourself. Without this the origin
 *    would be hit on essentially every page load.
 * 2. **One response covers both satellites,** so switching satellites in the UI
 *    costs no upstream request at all.
 * 3. **Six-hour TTL.** CelesTrak refreshes these files every two hours at most,
 *    and blocks clients that re-download faster than the data changes.
 *
 * If CelesTrak is unavailable we serve the last good copy rather than failing:
 * a TLE hours past its cache window is still perfectly accurate.
 */
import { TLE_CACHE_SECONDS, TRACKED_SATELLITES } from '../../shared/catalogue';

const CELESTRAK_GP = 'https://celestrak.org/NORAD/elements/gp.php';

type Ctx = {
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
};

type TleRecord = { name: string; line1: string; line2: string };

export async function onRequestGet({ request, waitUntil }: Ctx): Promise<Response> {
  const cache = edgeCache();
  const cacheKey = new Request(new URL('/api/tle', request.url).toString());

  const cached = await cache?.match(cacheKey);
  if (cached) return cached;

  let satellites: Record<string, TleRecord>;
  try {
    satellites = await fetchAll();
  } catch (cause) {
    // Prefer stale elements over no elements.
    const stale = await cache?.match(cacheKey, { ignoreMethod: true });
    if (stale) return stale;

    return json({ error: describe(cause) }, 502, 'no-store');
  }

  const response = json(
    { satellites, fetchedAt: new Date().toISOString() },
    200,
    `public, s-maxage=${TLE_CACHE_SECONDS}, stale-while-revalidate=${TLE_CACHE_SECONDS}, stale-if-error=86400`,
  );

  if (cache) {
    const write = cache.put(cacheKey, response.clone());
    if (waitUntil) waitUntil(write);
    else await write;
  }

  return response;
}

async function fetchAll(): Promise<Record<string, TleRecord>> {
  const entries = await Promise.all(
    TRACKED_SATELLITES.map(async (satellite) => {
      const url = new URL(CELESTRAK_GP);
      url.searchParams.set('CATNR', String(satellite.catalogNumber));
      url.searchParams.set('FORMAT', 'TLE');

      const response = await fetch(url, {
        headers: { Accept: 'text/plain' },
        // Cloudflare caches the subrequest itself too, so concurrent misses
        // across a colo collapse into a single origin fetch.
        cf: { cacheTtl: TLE_CACHE_SECONDS, cacheEverything: true },
      });

      if (!response.ok) {
        throw new Error(`CelesTrak responded ${response.status} for ${satellite.label}.`);
      }

      const text = (await response.text()).trim();
      if (!text || text.startsWith('No GP data found')) {
        throw new Error(`No orbital data found for ${satellite.label}.`);
      }

      return [satellite.id, parseTle(text, satellite.label)] as const;
    }),
  );

  return Object.fromEntries(entries);
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
  return message.includes('403')
    ? 'CelesTrak is rate limiting this deployment. Serving no elements until it clears.'
    : message;
}

function json(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });
}
