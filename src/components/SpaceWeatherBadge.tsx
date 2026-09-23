/** Geomagnetic conditions, as a compact top-bar readout. */
import { classifyKp, formatKp } from '../lib/spaceWeather';
import type { SpaceWeather } from '../lib/types';

type Props = {
  /** Null until /api/spaceweather has been read. */
  weather: SpaceWeather | null;
  error?: string | null;
};

export function SpaceWeatherBadge({ weather, error }: Props) {
  if (error) {
    return (
      <div className="kp" title={error}>
        <span className="kp__label">Geomagnetic</span>
        <span className="kp__value kp__value--error">Unavailable</span>
      </div>
    );
  }

  const level = weather ? classifyKp(weather.kp) : null;

  return (
    <div
      className="kp"
      title={weather ? `Observed ${new Date(weather.observedAt).toUTCString()} · NOAA SWPC` : undefined}
    >
      <span className="kp__label">Geomagnetic</span>
      <span className="kp__value">
        <span className="kp__dot" data-tone={level?.tone ?? 'unknown'} />
        {weather ? `Kp ${formatKp(weather.kp)}` : 'Kp —'}
        <span className="kp__level">{level ? (level.storm ?? level.label) : 'Awaiting'}</span>
      </span>
    </div>
  );
}
