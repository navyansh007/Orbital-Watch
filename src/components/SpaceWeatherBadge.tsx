/** Geomagnetic risk badge, driven by NOAA's planetary K-index. */
import { classifyKp, formatKp } from '../lib/spaceWeather';
import type { SpaceWeather } from '../lib/types';

type Props = {
  /** Null until /api/spaceweather has been read. */
  weather: SpaceWeather | null;
  error?: string | null;
};

export function SpaceWeatherBadge({ weather, error }: Props) {
  const level = weather ? classifyKp(weather.kp) : null;

  return (
    <section className="panel">
      <h2 className="panel__title">Geomagnetic activity</h2>

      {error ? (
        <p className="badge__error">{error}</p>
      ) : (
        <div className="badge" data-tone={level?.tone ?? 'unknown'}>
          <span className="badge__kp">{weather ? `Kp ${formatKp(weather.kp)}` : 'Kp —'}</span>
          <span className="badge__level">
            {level ? [level.storm, level.label].filter(Boolean).join(' · ') : 'Awaiting NOAA SWPC'}
          </span>
        </div>
      )}

      {weather && (
        <p className="panel__footnote">
          Observed {new Date(weather.observedAt).toUTCString()} · NOAA SWPC
        </p>
      )}
    </section>
  );
}
