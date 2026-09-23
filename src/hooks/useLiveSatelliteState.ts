/**
 * The propagation loop: turns a static SGP4 record into a live position.
 *
 * A ticking timestamp drives the re-render and the state is derived from it
 * during render, so there is exactly one source of truth and no position state
 * to keep in sync.
 */
import { useEffect, useMemo, useState } from 'react';
import type { SatRec } from 'satellite.js';

import { stateAt } from '../lib/satellites';
import type { SatelliteState } from '../lib/types';

/** ~1 Hz, per spec. SGP4 costs microseconds, so this is nowhere near a bottleneck. */
const TICK_MS = 1000;

export type LiveSatellite = {
  /** The clock driving the loop, exposed so other derived data shares one timebase. */
  nowMs: number;
  state: SatelliteState | null;
};

export function useLiveSatelliteState(satrec: SatRec | null): LiveSatellite {
  const [tickMs, setTickMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTickMs(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const state = useMemo(
    () => (satrec ? stateAt(satrec, new Date(tickMs)) : null),
    [satrec, tickMs],
  );

  return { nowMs: tickMs, state };
}
