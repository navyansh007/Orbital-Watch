/** Live position/velocity readout for the tracked satellite. */
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
  return (
    <section className="panel">
      <h2 className="panel__title">Telemetry</h2>
      <p className="panel__subtitle">{satellite.blurb}</p>

      {error && <p className="panel__error">{error}</p>}
      {!error && !state && <p className="panel__footnote">Loading orbital elements…</p>}

      <dl className="readout">
        <Row label="Latitude" value={state && `${formatDeg(state.latitudeDeg)} ${state.latitudeDeg >= 0 ? 'N' : 'S'}`} />
        <Row label="Longitude" value={state && `${formatDeg(state.longitudeDeg)} ${state.longitudeDeg >= 0 ? 'E' : 'W'}`} />
        <Row label="Altitude" value={state && `${state.altitudeKm.toFixed(1)} km`} />
        <Row label="Velocity" value={state && `${state.velocityKmS.toFixed(3)} km/s`} />
        <Row
          label="Footprint radius"
          value={state && `${footprintRadiusKm(state.altitudeKm).toFixed(0)} km`}
        />
        <Row
          label="Earth covered"
          value={state && `${(footprintCoverageFraction(state.altitudeKm) * 100).toFixed(1)} %`}
        />
        <Row
          label="Orbital period"
          value={periodMinutes ? `${periodMinutes.toFixed(1)} min` : null}
        />
        <Row label="Epoch" value={state && state.timestamp.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'} />
      </dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="readout__row">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  );
}

function formatDeg(value: number): string {
  return `${Math.abs(value).toFixed(3)}°`;
}
