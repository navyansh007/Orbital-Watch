/**
 * Orbital mechanics layer.
 *
 * Wraps satellite.js (a pure-JS SGP4 implementation) behind the small surface
 * the UI actually needs: fetch real TLEs, turn a timestamp into a geodetic
 * state vector, and predict overhead passes for a ground site.
 *
 * Everything here is client-side — SGP4 is cheap enough to run in the browser
 * at 1 Hz, and it keeps the edge routes as dumb caches.
 */
import {
  degreesLat,
  degreesLong,
  eciToEcf,
  eciToGeodetic,
  ecfToLookAngles,
  gstime,
  propagate,
  twoline2satrec,
} from 'satellite.js';
import type { SatRec } from 'satellite.js';

import type {
  GeoPoint,
  GroundSite,
  GroundTrack,
  PassPrediction,
  SatelliteDefinition,
  SatelliteId,
  SatelliteState,
  VisibilityReport,
} from './types';

/**
 * v1 catalogue: one fast LEO mover and one fixed GEO watcher. Names must match
 * CelesTrak's catalogue exactly — they are forwarded verbatim to /api/tle.
 */
export const SATELLITES: Record<SatelliteId, SatelliteDefinition> = {
  iss: {
    id: 'iss',
    celestrakName: 'ISS (ZARYA)',
    label: 'ISS (ZARYA)',
    orbitClass: 'LEO',
    color: '#4dd2ff',
    blurb: 'Low Earth orbit — circles the planet roughly every 90 minutes.',
  },
  goes: {
    id: 'goes',
    celestrakName: 'GOES 19',
    label: 'GOES 19',
    orbitClass: 'GEO',
    color: '#ffb347',
    blurb: 'Geostationary — parked over the Americas, watching one hemisphere.',
  },
};

export const SATELLITE_LIST: SatelliteDefinition[] = Object.values(SATELLITES);

/** Thrown when orbital data cannot be fetched or parsed. */
export class OrbitalDataError extends Error {}

/**
 * Fetches a satellite's current TLE through our own edge proxy and parses it
 * into an SGP4 record.
 */
export async function loadSatRec(
  definition: SatelliteDefinition,
  signal?: AbortSignal,
): Promise<SatRec> {
  const response = await fetch(
    `/api/tle?name=${encodeURIComponent(definition.celestrakName)}`,
    { signal },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new OrbitalDataError(
      `Could not load orbital data for ${definition.label} (${response.status}). ${detail}`.trim(),
    );
  }

  return parseTle(await response.text(), definition.label);
}

/**
 * Parses the first TLE set out of a CelesTrak response. The response is a
 * three-line-per-object listing: name, line 1, line 2.
 */
export function parseTle(text: string, label: string): SatRec {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const line1Index = lines.findIndex((line) => line.startsWith('1 '));
  const line1 = lines[line1Index];
  const line2 = lines[line1Index + 1];

  if (!line1 || !line2?.startsWith('2 ')) {
    throw new OrbitalDataError(`Malformed TLE received for ${label}.`);
  }

  const satrec = twoline2satrec(line1, line2);
  if (satrec.error) {
    throw new OrbitalDataError(`TLE for ${label} rejected by SGP4 (code ${satrec.error}).`);
  }

  return satrec;
}

/**
 * Propagates a satellite to `timestamp` and converts the result to geodetic
 * coordinates. Returns null when SGP4 cannot produce a position (a decayed or
 * otherwise unpropagatable object).
 */
export function stateAt(satrec: SatRec, timestamp: Date): SatelliteState | null {
  const propagated = propagate(satrec, timestamp);
  if (!propagated?.position || !propagated.velocity) return null;

  const geodetic = eciToGeodetic(propagated.position, gstime(timestamp));
  const { x, y, z } = propagated.velocity;

  return {
    timestamp,
    latitudeDeg: degreesLat(geodetic.latitude),
    longitudeDeg: degreesLong(geodetic.longitude),
    altitudeKm: geodetic.height,
    velocityKmS: Math.hypot(x, y, z),
  };
}

/**
 * Samples the sub-satellite point at a fixed cadence over a time window.
 *
 * Samples must be close enough together that consecutive points are less than
 * half the globe apart, otherwise a renderer cannot tell which way round the
 * Earth the path went.
 */
export function sampleGroundTrack(
  satrec: SatRec,
  from: Date,
  to: Date,
  stepSeconds: number,
): GeoPoint[] {
  const points: GeoPoint[] = [];
  const stepMs = stepSeconds * 1000;

  for (let ms = from.getTime(); ms <= to.getTime(); ms += stepMs) {
    const state = stateAt(satrec, new Date(ms));
    if (state) {
      points.push({ latitudeDeg: state.latitudeDeg, longitudeDeg: state.longitudeDeg });
    }
  }

  return points;
}

/**
 * The ground track either side of `at`, as the HUD wants to draw it: the recent
 * path behind the satellite and a short prediction ahead.
 */
export function groundTrackAround(
  satrec: SatRec,
  at: Date,
  pastMinutes: number,
  futureMinutes: number,
  stepSeconds = 20,
): GroundTrack {
  return {
    past: sampleGroundTrack(satrec, new Date(at.getTime() - pastMinutes * 60_000), at, stepSeconds),
    future: sampleGroundTrack(
      satrec,
      at,
      new Date(at.getTime() + futureMinutes * 60_000),
      stepSeconds,
    ),
  };
}

/**
 * Orbital period in minutes, from the mean motion carried in the TLE.
 *
 * `satrec.no` is mean motion in radians per minute, so the period is simply one
 * full revolution divided by it.
 */
export function orbitalPeriodMinutes(satrec: SatRec): number | null {
  return satrec.no > 0 ? (2 * Math.PI) / satrec.no : null;
}

/** Elevation of the satellite above a ground site's local horizon, in degrees. */
export function elevationDegAt(satrec: SatRec, site: GroundSite, timestamp: Date): number | null {
  const propagated = propagate(satrec, timestamp);
  if (!propagated?.position) return null;

  const gmst = gstime(timestamp);
  const lookAngles = ecfToLookAngles(
    {
      latitude: degToRad(site.latitudeDeg),
      longitude: degToRad(site.longitudeDeg),
      height: site.altitudeKm,
    },
    eciToEcf(propagated.position, gmst),
  );

  return radToDeg(lookAngles.elevation);
}

export type NextPassOptions = {
  /** Minimum elevation that counts as a usable pass. */
  minElevationDeg?: number;
  /** How far ahead to search. */
  searchHours?: number;
  /** Coarse scan step, in seconds. */
  coarseStepSeconds?: number;
};

/**
 * Finds the next time a satellite rises above `minElevationDeg` as seen from
 * `site`, by coarse-scanning forward and then bisecting the rise and set
 * crossings. Returns null if no pass occurs inside the search window.
 */
export function findNextPass(
  satrec: SatRec,
  site: GroundSite,
  from: Date,
  options: NextPassOptions = {},
): PassPrediction | null {
  const { minElevationDeg = 10, searchHours = 48, coarseStepSeconds = 30 } = options;

  const startMs = from.getTime();
  const endMs = startMs + searchHours * 3_600_000;
  const stepMs = coarseStepSeconds * 1000;

  const elevationAt = (ms: number) => elevationDegAt(satrec, site, new Date(ms)) ?? -90;

  let previousMs = startMs;
  let previousElevation = elevationAt(previousMs);

  for (let ms = startMs + stepMs; ms <= endMs; ms += stepMs) {
    const elevation = elevationAt(ms);

    if (previousElevation < minElevationDeg && elevation >= minElevationDeg) {
      const startsAt = bisectCrossing(elevationAt, previousMs, ms, minElevationDeg);
      const { peakMs, maxElevationDeg, endMs: passEndMs } = trackPass(
        elevationAt,
        startsAt,
        endMs,
        stepMs,
        minElevationDeg,
      );

      return {
        startsAt: new Date(startsAt),
        peaksAt: new Date(peakMs),
        endsAt: new Date(passEndMs),
        maxElevationDeg,
      };
    }

    previousMs = ms;
    previousElevation = elevation;
  }

  return null;
}

/**
 * Answers "what will this site see of this satellite?", picking the question
 * that actually makes sense for the orbit.
 *
 * Geostationary satellites hold station over one longitude, so they never rise
 * or set: searching for a pass would either return the present instant or scan
 * the whole window and find nothing. For those we report standing visibility.
 */
export function reportVisibility(
  satrec: SatRec,
  definition: SatelliteDefinition,
  site: GroundSite,
  from: Date,
  options: NextPassOptions = {},
): VisibilityReport {
  const { minElevationDeg = 10, searchHours = 48 } = options;

  if (definition.orbitClass === 'GEO') {
    const elevation = elevationDegAt(satrec, site, from);
    if (elevation === null) return { kind: 'never-visible' };

    return elevation >= minElevationDeg
      ? { kind: 'always-visible', elevationDeg: elevation }
      : { kind: 'never-visible' };
  }

  const pass = findNextPass(satrec, site, from, options);
  return pass ? { kind: 'pass', pass } : { kind: 'no-pass-in-window', searchHours };
}

/** Walks a pass forward from its rise time to find its peak and set times. */
function trackPass(
  elevationAt: (ms: number) => number,
  riseMs: number,
  limitMs: number,
  stepMs: number,
  minElevationDeg: number,
): { peakMs: number; maxElevationDeg: number; endMs: number } {
  // A fine step keeps the reported peak elevation honest to within ~0.1 deg.
  const fineStepMs = Math.max(1000, stepMs / 6);

  let peakMs = riseMs;
  let maxElevationDeg = elevationAt(riseMs);
  let previousMs = riseMs;
  let previousElevation = maxElevationDeg;

  for (let ms = riseMs + fineStepMs; ms <= limitMs; ms += fineStepMs) {
    const elevation = elevationAt(ms);

    if (elevation > maxElevationDeg) {
      maxElevationDeg = elevation;
      peakMs = ms;
    }

    if (elevation < minElevationDeg) {
      return {
        peakMs,
        maxElevationDeg,
        endMs: bisectCrossing(elevationAt, previousMs, ms, minElevationDeg),
      };
    }

    previousMs = ms;
    previousElevation = elevation;
  }

  return { peakMs, maxElevationDeg, endMs: previousMs + (previousElevation >= 0 ? 0 : fineStepMs) };
}

/**
 * Narrows a bracketed elevation crossing to ~1 second. `lowMs` and `highMs`
 * must sit on opposite sides of `targetDeg`.
 */
function bisectCrossing(
  elevationAt: (ms: number) => number,
  lowMs: number,
  highMs: number,
  targetDeg: number,
): number {
  let low = lowMs;
  let high = highMs;

  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    if (elevationAt(mid) < targetDeg) low = mid;
    else high = mid;
  }

  return high;
}

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}
