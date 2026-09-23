/**
 * The satellite's recent and upcoming ground path.
 *
 * Recomputed on a coarse cadence rather than every propagation tick: the track
 * spans tens of minutes, so a one-second shift is invisible, and resampling it
 * at 1 Hz would be hundreds of wasted SGP4 calls per second.
 */
import { useMemo } from 'react';
import type { SatRec } from 'satellite.js';

import { groundTrackAround } from '../lib/satellites';
import type { GroundTrack, SatelliteDefinition } from '../lib/types';

const RESAMPLE_INTERVAL_MS = 15_000;

/**
 * A LEO satellite covers a useful arc in well under an hour. A geostationary
 * one holds station, so it has no ground track worth drawing.
 */
const WINDOWS: Record<SatelliteDefinition['orbitClass'], { past: number; future: number }> = {
  LEO: { past: 45, future: 30 },
  GEO: { past: 0, future: 0 },
};

export function useGroundTrack(
  satrec: SatRec | null,
  definition: SatelliteDefinition,
  nowMs: number,
): GroundTrack | null {
  const bucket = Math.floor(nowMs / RESAMPLE_INTERVAL_MS);
  const window = WINDOWS[definition.orbitClass];

  return useMemo(() => {
    if (!satrec || (window.past === 0 && window.future === 0)) return null;

    return groundTrackAround(
      satrec,
      new Date(bucket * RESAMPLE_INTERVAL_MS),
      window.past,
      window.future,
    );
    // `bucket` is the intentional coarse clock; nowMs itself would thrash this.
  }, [satrec, bucket, window.past, window.future]);
}
