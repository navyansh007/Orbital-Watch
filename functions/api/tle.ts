/**
 * GET /api/tle?name=<satellite name>
 *
 * Thin fetch-and-forward proxy for CelesTrak's public GP/TLE endpoint. Exists
 * so the browser is not blocked by CelesTrak's CORS policy and so responses
 * are cached at the edge for an hour (TLEs are only refreshed a few times a
 * day upstream).
 */
const CELESTRAK_GP = 'https://celestrak.org/NORAD/elements/gp.php';

export async function onRequestGet({ request }: { request: Request }): Promise<Response> {
  const name = new URL(request.url).searchParams.get('name');

  if (!name) {
    return json({ error: 'Missing required "name" query parameter.' }, 400);
  }

  const upstream = new URL(CELESTRAK_GP);
  upstream.searchParams.set('NAME', name);
  upstream.searchParams.set('FORMAT', 'TLE');

  let response: Response;
  try {
    response = await fetch(upstream, { headers: { Accept: 'text/plain' } });
  } catch {
    return json({ error: 'Could not reach CelesTrak.' }, 502);
  }

  if (!response.ok) {
    return json({ error: `CelesTrak responded ${response.status}.` }, 502);
  }

  const text = (await response.text()).trim();

  // CelesTrak answers an unknown name with a 200 and this sentinel body.
  if (!text || text.startsWith('No GP data found')) {
    return json({ error: `No orbital data found for "${name}".` }, 404);
  }

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
