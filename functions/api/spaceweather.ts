/**
 * GET /api/spaceweather
 *
 * Proxies NOAA SWPC's public planetary K-index feed and reduces it to the most
 * recent reading, which is all the risk badge needs. Cached ~5 minutes at the
 * edge; upstream publishes a new sample every minute.
 */
const SWPC_KP_1M = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';

type SwpcKpSample = {
  time_tag?: string;
  kp_index?: number | string;
  estimated_kp?: number | string;
};

export async function onRequestGet(_ctx: { request: Request }): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(SWPC_KP_1M, { headers: { Accept: 'application/json' } });
  } catch {
    return json({ error: 'Could not reach NOAA SWPC.' }, 502);
  }

  if (!response.ok) {
    return json({ error: `NOAA SWPC responded ${response.status}.` }, 502);
  }

  const samples = (await response.json()) as SwpcKpSample[];
  const latest = Array.isArray(samples) ? samples.at(-1) : undefined;
  const kp = toNumber(latest?.estimated_kp ?? latest?.kp_index);

  if (!latest?.time_tag || kp === null) {
    return json({ error: 'NOAA SWPC returned an unexpected payload shape.' }, 502);
  }

  return json(
    {
      kp,
      // SWPC time tags are UTC but not always suffixed as such.
      observedAt: new Date(`${latest.time_tag.replace(' ', 'T')}Z`).toISOString(),
      source: SWPC_KP_1M,
    },
    200,
    'public, s-maxage=300, stale-while-revalidate=60',
  );
}

function toNumber(value: number | string | undefined): number | null {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function json(body: unknown, status: number, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });
}
