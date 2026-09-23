/**
 * Current geomagnetic conditions from NOAA SWPC.
 *
 * NOAA publishes a new K-index sample every minute; polling every five is more
 * than enough to keep the badge honest, and matches the edge cache on our proxy
 * so most of these reads never leave Cloudflare.
 */
import { useEffect, useState } from 'react';

import { fetchSpaceWeather } from '../lib/spaceWeather';
import type { SpaceWeather } from '../lib/types';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export type SpaceWeatherState = {
  weather: SpaceWeather | null;
  error: string | null;
};

export function useSpaceWeather(): SpaceWeatherState {
  const [weather, setWeather] = useState<SpaceWeather | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const next = await fetchSpaceWeather(controller.signal);
        if (controller.signal.aborted) return;
        setWeather(next);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    };

    void load();
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return { weather, error };
}
