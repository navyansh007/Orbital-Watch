/**
 * Keeps a current SGP4 record for the tracked satellite.
 *
 * Fetches the TLE through our own edge proxy on mount and whenever the tracked
 * satellite changes, then refreshes hourly — CelesTrak republishes elements a
 * few times a day, and a tab left open overnight would otherwise propagate from
 * increasingly stale elements.
 */
import { useEffect, useState } from 'react';
import type { SatRec } from 'satellite.js';

import { loadSatRec } from '../lib/satellites';
import type { SatelliteDefinition, SatelliteId } from '../lib/types';

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

type Loaded = { id: SatelliteId; satrec: SatRec };
type Failed = { id: SatelliteId; message: string };

export type SatelliteRecord = {
  satrec: SatRec | null;
  error: string | null;
};

export function useSatelliteRecord(definition: SatelliteDefinition): SatelliteRecord {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<Failed | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const satrec = await loadSatRec(definition, controller.signal);
        if (controller.signal.aborted) return;
        setLoaded({ id: definition.id, satrec });
        setFailed(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setFailed({
          id: definition.id,
          message: cause instanceof Error ? cause.message : String(cause),
        });
      }
    };

    void load();
    const timer = setInterval(() => void load(), REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [definition]);

  // Results carry the satellite they belong to, so switching satellites reads
  // as "nothing yet" instead of briefly showing the previous one's orbit.
  return {
    satrec: loaded?.id === definition.id ? loaded.satrec : null,
    error: failed?.id === definition.id ? failed.message : null,
  };
}
