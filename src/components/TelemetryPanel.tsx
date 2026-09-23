/** Live telemetry, as a stat strip across the foot of the screen. */
import { footprintCoverageFraction, footprintRadiusKm } from '../lib/footprint';
import type { SatelliteDefinition, SatelliteState } from '../lib/types';

type Props = {
  satellite: SatelliteDefinition;
  /** Null until the first propagation completes. */
  state: SatelliteState | null;
  /** Set when the orbital elements could not be loaded. */
  error?: string | null;
  /** Orbital period in minutes, from the TLE's mean motion. */
  periodMinutes?: number | null;
};

export function TelemetryPanel({ satellite, state, error, periodMinutes }: Props) {
  if (error) {
    return (
      <div className="telemetry telemetry--error">
        <span className="stat__label">Orbital data</span>
        <span className="telemetry__error">{error}</span>
      </div>
    );
  }

  return (
    <div className="telemetry">
      <Stat
        label="Satellite"
        value={satellite.label}
        note={satellite.orbitClass === 'LEO' ? 'Low Earth orbit' : 'Geostationary'}
      />
      <Stat label="Latitude" value={state && formatLat(state.latitudeDeg)} />
      <Stat label="Longitude" value={state && formatLon(state.longitudeDeg)} />
      <Stat label="Altitude" value={state && `${state.altitudeKm.toFixed(1)} km`} />
      <Stat label="Velocity" value={state && `${state.velocityKmS.toFixed(3)} km/s`} />
      <Stat
        label="Footprint"
        value={state && `${footprintRadiusKm(state.altitudeKm).toFixed(0)} km`}
        note={state ? `${(footprintCoverageFraction(state.altitudeKm) * 100).toFixed(1)}% of Earth` : undefined}
      />
      <Stat label="Period" value={periodMinutes ? `${periodMinutes.toFixed(1)} min` : null} />
      <Stat label="Epoch" value={state && `${formatUtc(state.timestamp)} UTC`} />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value ?? '—'}</span>
      {note && <span className="stat__note">{note}</span>}
    </div>
  );
}

function formatLat(value: number): string {
  return `${Math.abs(value).toFixed(3)}° ${value >= 0 ? 'N' : 'S'}`;
}

function formatLon(value: number): string {
  return `${Math.abs(value).toFixed(3)}° ${value >= 0 ? 'E' : 'W'}`;
}

function formatUtc(at: Date): string {
  return at.toISOString().slice(11, 19);
}
