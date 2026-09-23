/**
 * Next-pass readout for a chosen ground site.
 *
 * The site is picked by clicking the globe or from the browser's geolocation;
 * this component renders whatever the propagator concluded.
 */
import { useEffect, useState } from 'react';

import type { GroundSite, SatelliteDefinition, VisibilityReport } from '../lib/types';

/** How often the "in 42m" countdown is refreshed. */
const COUNTDOWN_TICK_MS = 30_000;

type Props = {
  satellite: SatelliteDefinition;
  site: GroundSite | null;
  report: VisibilityReport | null;
  /** True while the satellite's orbit is still loading. */
  loading: boolean;
  onUseMyLocation: () => void;
  onClear: () => void;
  locationError?: string | null;
};

export function NextPassFinder({
  satellite,
  site,
  report,
  loading,
  onUseMyLocation,
  onClear,
  locationError,
}: Props) {
  const nowMs = useCountdownClock(report?.kind === 'pass');

  return (
    <section className="panel">
      <h2 className="panel__title">Next pass</h2>

      {site ? (
        <p className="panel__subtitle">
          {formatSite(site)}{' '}
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

      {locationError && <p className="panel__error">{locationError}</p>}
      {site && loading && <p className="panel__footnote">Loading orbital elements…</p>}
      {site && !loading && report && (
        <Report satellite={satellite} report={report} nowMs={nowMs} />
      )}
    </section>
  );
}

function Report({
  satellite,
  report,
  nowMs,
}: {
  satellite: SatelliteDefinition;
  report: VisibilityReport;
  nowMs: number;
}) {
  switch (report.kind) {
    case 'pass':
      return (
        <dl className="readout">
          <Row label="Rises in" value={formatDuration(report.pass.startsAt.getTime() - nowMs)} />
          <Row label="Rises at" value={formatClock(report.pass.startsAt)} />
          <Row label="Peak elevation" value={`${report.pass.maxElevationDeg.toFixed(1)}°`} />
          <Row
            label="Visible for"
            value={formatDuration(report.pass.endsAt.getTime() - report.pass.startsAt.getTime())}
          />
        </dl>
      );

    case 'always-visible':
      return (
        <>
          <dl className="readout">
            <Row label="Elevation" value={`${report.elevationDeg.toFixed(1)}°`} />
          </dl>
          <p className="panel__footnote">
            {satellite.label} holds station over one longitude, so it never rises or sets here —
            it is permanently in view.
          </p>
        </>
      );

    case 'never-visible':
      return (
        <p className="panel__footnote">
          {satellite.label} sits below this site's horizon and never rises — it is
          geostationary over the other side of the planet.
        </p>
      );

    case 'no-pass-in-window':
      return (
        <p className="panel__footnote">
          No {satellite.label} pass above 10° from this site in the next {report.searchHours} hours.
        </p>
      );
  }
}

/** Re-renders periodically so a displayed countdown does not go stale. */
function useCountdownClock(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNowMs(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [active]);

  return nowMs;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="readout__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatSite(site: GroundSite): string {
  const ns = site.latitudeDeg >= 0 ? 'N' : 'S';
  const ew = site.longitudeDeg >= 0 ? 'E' : 'W';
  return `${Math.abs(site.latitudeDeg).toFixed(3)}° ${ns}, ${Math.abs(site.longitudeDeg).toFixed(3)}° ${ew}`;
}

/** Local wall-clock time — a pass time is something you act on where you are. */
function formatClock(at: Date): string {
  return at.toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
