/**
 * Next-pass readout for a chosen ground site.
 *
 * The site itself is picked by clicking the globe or using the browser's
 * geolocation; this component only renders the result. Wiring the globe click
 * and the search happens in a later milestone.
 */
import type { GroundSite, PassPrediction, SatelliteDefinition } from '../lib/types';

type Props = {
  satellite: SatelliteDefinition;
  site: GroundSite | null;
  prediction: PassPrediction | null;
  searching: boolean;
  onUseMyLocation: () => void;
  onClear: () => void;
};

export function NextPassFinder({
  satellite,
  site,
  prediction,
  searching,
  onUseMyLocation,
  onClear,
}: Props) {
  return (
    <section className="panel">
      <h2 className="panel__title">Next pass</h2>

      {site ? (
        <p className="panel__subtitle">
          {formatSite(site)}
          <button type="button" className="link" onClick={onClear}>
            clear
          </button>
        </p>
      ) : (
        <p className="panel__subtitle">
          Click anywhere on the globe to pick a ground site, or{' '}
          <button type="button" className="link" onClick={onUseMyLocation}>
            use my location
          </button>
          .
        </p>
      )}

      {searching && <p className="panel__footnote">Propagating…</p>}

      {!searching && site && !prediction && (
        <p className="panel__footnote">
          No {satellite.label} pass above 10° from this site in the next 48 hours.
        </p>
      )}

      {!searching && prediction && (
        <dl className="readout">
          <div className="readout__row">
            <dt>Rises</dt>
            <dd>{prediction.startsAt.toUTCString()}</dd>
          </div>
          <div className="readout__row">
            <dt>In</dt>
            <dd>{formatCountdown(prediction.startsAt)}</dd>
          </div>
          <div className="readout__row">
            <dt>Peak elevation</dt>
            <dd>{prediction.maxElevationDeg.toFixed(1)}°</dd>
          </div>
          <div className="readout__row">
            <dt>Duration</dt>
            <dd>{formatDuration(prediction.endsAt.getTime() - prediction.startsAt.getTime())}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function formatSite(site: GroundSite): string {
  const ns = site.latitudeDeg >= 0 ? 'N' : 'S';
  const ew = site.longitudeDeg >= 0 ? 'E' : 'W';
  return `${Math.abs(site.latitudeDeg).toFixed(3)}° ${ns}, ${Math.abs(site.longitudeDeg).toFixed(3)}° ${ew}`;
}

function formatCountdown(target: Date): string {
  return formatDuration(target.getTime() - Date.now());
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
