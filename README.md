# Orbital Watch

A live, real-physics satellite tracker. Real satellites, their real position,
their real coverage footprint, and real geomagnetic conditions — rendered on a
3D globe.

Inspired by the *GoldenEye* (1995) satellite-footprint visual: an orbiting
object with a circle sweeping the Earth beneath it. Here that circle is a real
thing — the satellite's horizon-limited coverage area, the same figure ham
operators and ground-station planners work with. Nothing on screen is
simulated, mocked, or hardcoded.

## What it shows

| | |
|---|---|
| **ISS (ZARYA)** | Low Earth orbit — a fast mover, one lap every ~90 minutes |
| **GOES 19** | Geostationary — parked over the Americas, effectively fixed |

Plus live telemetry (lat/lon/altitude/velocity), a next-pass predictor for any
point you click, and a NOAA planetary K-index badge for current geomagnetic
activity.

## Stack

- **Vite + React + TypeScript** — static SPA, no server rendering
- **CesiumJS** (raw, mounted in one component) — 3D globe and Earth imagery
- **satellite.js** — SGP4 propagation, entirely client-side
- **Cloudflare Pages** — static hosting, with two Pages Functions as data proxies

### Data sources

| Source | Used for | Proxy route |
|---|---|---|
| [CelesTrak](https://celestrak.org) | Two-line orbital elements | `/api/tle?name=<catalogue name>` |
| [NOAA SWPC](https://services.swpc.noaa.gov) | Planetary K-index | `/api/spaceweather` |

Both routes are thin fetch-and-forward proxies. They exist to sidestep upstream
CORS and to cache at the edge (TLEs ~1 hour, Kp ~5 minutes), not to compute
anything.

## Getting started

```bash
npm install
cp .env.example .env.local   # then paste in your Cesium Ion token
npm run dev
```

A free **Cesium Ion access token** is required for the default Earth imagery
and terrain — grab one at [cesium.com/ion/tokens](https://cesium.com/ion/tokens)
and set `VITE_CESIUM_ION_TOKEN` in `.env.local`. It is a client-side token by
nature, so it must carry Vite's `VITE_` prefix.

`npm run dev` serves the Pages Functions from the Vite dev server, so `/api/*`
works locally against the same handler code that runs in production.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server, with `/api/*` handled by the real function code |
| `npm run build` | Typecheck all three TS projects, then build to `dist/` |
| `npm run preview` | Serve the build with Vite (static only — no `/api/*`) |
| `npm run preview:cf` | Serve the build through Wrangler — closest thing to production |
| `npm run deploy` | Build and deploy to Cloudflare Pages |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc -b` across app, build tooling, and functions |

## Layout

```
functions/api/        Cloudflare Pages Functions (Workers runtime, web APIs only)
  tle.ts              CelesTrak proxy
  spaceweather.ts     NOAA SWPC proxy
src/
  components/         Globe (Cesium mount) + HUD panels
  lib/
    satellites.ts     SGP4 wrapper: catalogue, TLE parsing, propagation, pass search
    footprint.ts      Coverage geometry: altitude -> horizon radius
    types.ts          Shared domain types
  styles/globals.css  Dark HUD theme
vite-plugins/         Dev-server bridge that runs functions/api/* locally
```

## Deployment

Cloudflare Pages, connected to this repo:

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `VITE_CESIUM_ION_TOKEN` (needed at **build** time — Vite
  inlines it into the bundle)

## Architecture notes

- **All physics is client-side.** Cesium needs WebGL and satellite.js is pure
  JS, so both run in the browser. The edge functions stay dumb caches — no Node
  APIs, no heavy compute, nothing that would break on the Workers runtime.
- **Footprint is geometry, not a guess.** `footprint.ts` derives the coverage
  radius from the satellite's horizon: `lambda = acos(R / (R + h))`, optionally
  narrowed by a minimum elevation angle.

## Non-goals

No weapons or harm simulation of any kind — the footprint is coverage and
visibility only. No accounts, no database, no more than two satellites in v1.
