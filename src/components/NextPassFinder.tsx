/**
 * The hero block: what the chosen ground site will see, and when.
 *
 * Headline is a live T-minus countdown to the next rise, driven by the shared
 * 1 Hz clock rather than a timer of its own.
 */
import { MIN_ELEVATION_DEG } from '../lib/satellites';
import type { GroundSite, SatelliteDefinition, VisibilityReport } from '../lib/types';

type Props = {
  satellite: SatelliteDefinition;
  site: GroundSite | null;
  report: VisibilityReport | null;
  /** Current elevation of the satellite from the site, if both are known. */
  elevationDeg: number | null;
  /** True while the satellite's orbit is still loading. */
  loading: boolean;
  nowMs: number;
  onUseMyLocation: () => void;
  onClear: () => void;
  locationError?: string | null;
};

export function NextPassFinder({
  satellite,
  site,
  report,
  elevationDeg,
  loading,
  nowMs,
  onUseMyLocation,
  onClear,
  locationError,
}: Props) {
  if (!site) {
    return (
      <div className="hero">
        <p className="hero__eyebrow">Pass prediction</p>
        <h2 className="hero__headline hero__headline--prompt">Select a ground site</h2>
        <p className="hero__meta">
          Click anywhere on the globe to compute when {satellite.label} next passes overhead.
        </p>
        {locationError && <p className="hero__error">{locationError}</p>}
        <button type="button" className="button" onClick={onUseMyLocation}>
          Use my location <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="hero">
      <p className="hero__eyebrow">
        Next pass · {formatSite(site)}
      </p>

      {loading ? (
        <h2 className="hero__headline hero__headline--prompt">Loading orbit…</h2>
      ) : (
        <Outcome
          satellite={satellite}
          report={report}
          elevationDeg={elevationDeg}
          nowMs={nowMs}
        />
      )}

      <button type="button" className="button" onClick={onClear}>
        Clear site
      </button>
    </div>
  );
}

function Outcome({
  satellite,
  report,
  elevationDeg,
  nowMs,
}: {
  satellite: SatelliteDefinition;
  report: VisibilityReport | null;
  elevationDeg: number | null;
  nowMs: number;
}) {
  // Overhead right now takes precedence over any future prediction.
  if (elevationDeg !== null && elevationDeg >= MIN_ELEVATION_DEG && report?.kind !== 'never-visible') {
    return (
      <>
        <h2 className="hero__headline">Overhead now</h2>
        <p className="hero__meta">
          {satellite.label} is {elevationDeg.toFixed(1)}° above the horizon
          {report?.kind === 'always-visible' && ' — geostationary, so it never sets here'}
        </p>
      </>
    );
  }

  if (!report) return null;

  switch (report.kind) {
    case 'pass':
      return (
        <>
          <h2 className="hero__headline hero__headline--clock">
            {formatCountdown(report.pass.startsAt.getTime() - nowMs)}
          </h2>
          <p className="hero__meta">
            Rises {formatClock(report.pass.startsAt)} · Peak{' '}
            {report.pass.maxElevationDeg.toFixed(1)}° · Visible{' '}
            {formatDuration(report.pass.endsAt.getTime() - report.pass.startsAt.getTime())}
          </p>
        </>
      );

    case 'always-visible':
      return (
        <>
          <h2 className="hero__headline">Always in view</h2>
          <p className="hero__meta">
            {satellite.label} holds station over one longitude — {report.elevationDeg.toFixed(1)}°
            above this horizon, permanently.
          </p>
        </>
      );

    case 'never-visible':
      return (
        <>
          <h2 className="hero__headline">Never in view</h2>
          <p className="hero__meta">
            {satellite.label} is geostationary over the far side of the planet and never rises here.
          </p>
        </>
      );

    case 'no-pass-in-window':
      return (
        <>
          <h2 className="hero__headline">No pass</h2>
          <p className="hero__meta">
            {satellite.label} stays below {MIN_ELEVATION_DEG}° from this site for the next{' '}
            {report.searchHours} hours.
          </p>
        </>
      );
  }
}

function formatSite(site: GroundSite): string {
  const ns = site.latitudeDeg >= 0 ? 'N' : 'S';
  const ew = site.longitudeDeg >= 0 ? 'E' : 'W';
  return `${Math.abs(site.latitudeDeg).toFixed(3)}° ${ns}, ${Math.abs(site.longitudeDeg).toFixed(3)}° ${ew}`;
}

/** Mission-clock style: `T-2D 14:07:46`, dropping the day field under 24 hours. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const clock = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  return days > 0 ? `T-${days}D ${clock}` : `T-${clock}`;
}

/** Local wall-clock time — a pass time is something you act on where you are. */
function formatClock(at: Date): string {
  return at.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
