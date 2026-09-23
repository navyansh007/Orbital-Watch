/**
 * Keeps current SGP4 records for every tracked satellite.
 *
 * One fetch covers all of them, so switching satellites in the UI costs no
 * network at all. The refresh interval matches the edge cache: CelesTrak only
 * republishes these elements a few times a day, and polling faster than that
 * is what gets a client blocked.
 */
import { useEffect, useState } from 'react';
import type { SatRec } from 'satellite.js';

import { fetchOrbitalElements } from '../lib/satellites';
import { TLE_CACHE_SECONDS } from '../../shared/catalogue';
import type { SatelliteId } from '../lib/types';

const REFRESH_INTERVAL_MS = TLE_CACHE_SECONDS * 1000;

export type OrbitalElements = {
  records: Record<SatelliteId, SatRec> | null;
  error: string | null;
};

export function useOrbitalElements(): OrbitalElements {
  const [records, setRecords] = useState<Record<SatelliteId, SatRec> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const next = await fetchOrbitalElements(controller.signal);
        if (controller.signal.aborted) return;
        setRecords(next);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    };

    void load();
    const timer = setInterval(() => void load(), REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return { records, error };
}
