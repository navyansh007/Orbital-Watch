/**
 * HUD shell.
 *
 * Owns the tracked satellite and the ground site, and runs the propagation
 * loop that every panel reads from.
 */
import { useMemo, useState } from 'react';

import { Globe } from './components/Globe';
import { NextPassFinder } from './components/NextPassFinder';
import { SatellitePicker } from './components/SatellitePicker';
import { SpaceWeatherBadge } from './components/SpaceWeatherBadge';
import { TelemetryPanel } from './components/TelemetryPanel';
import { useGroundTrack } from './hooks/useGroundTrack';
import { useLiveSatelliteState } from './hooks/useLiveSatelliteState';
import { useSatelliteRecord } from './hooks/useSatelliteRecord';
import { SATELLITES, reportVisibility } from './lib/satellites';
import type { GroundSite, SatelliteId } from './lib/types';

export default function App() {
  const [selectedId, setSelectedId] = useState<SatelliteId>('iss');
  const [site, setSite] = useState<GroundSite | null>(null);

  const satellite = SATELLITES[selectedId];
  const { satrec, error: orbitError } = useSatelliteRecord(satellite);
  const { nowMs, state } = useLiveSatelliteState(satrec);
  const groundTrack = useGroundTrack(satrec, satellite, nowMs);
  const [locationError, setLocationError] = useState<string | null>(null);

  // A 48-hour search is a few thousand SGP4 calls — under 10 ms — so it runs
  // inline. It deliberately does not depend on the 1 Hz clock: a pass time does
  // not change second to second, and recomputing it would be pure waste.
  const report = useMemo(
    () => (satrec && site ? reportVisibility(satrec, satellite, site, new Date()) : null),
    [satrec, satellite, site],
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('This browser does not expose a location.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationError(null);
        setSite({
          latitudeDeg: coords.latitude,
          longitudeDeg: coords.longitude,
          altitudeKm: (coords.altitude ?? 0) / 1000,
        });
      },
      (cause) => setLocationError(`Could not read your location: ${cause.message}`),
    );
  };

  return (
    <div className="app">
      <Globe
        tracked={state ? { definition: satellite, state } : null}
        groundTrack={groundTrack}
        site={site}
        onPickSite={(picked) => {
          setLocationError(null);
          setSite(picked);
        }}
      />

      <header className="app__header">
        <h1 className="app__title">Orbital Watch</h1>
        <p className="app__tagline">Live orbits, real footprints, real space weather.</p>
      </header>

      <aside className="app__hud">
        <SatellitePicker selected={selectedId} onSelect={setSelectedId} />
        <TelemetryPanel satellite={satellite} state={state} error={orbitError} />
        <NextPassFinder
          satellite={satellite}
          site={site}
          report={report}
          loading={!satrec && !orbitError}
          locationError={locationError}
          onUseMyLocation={useMyLocation}
          onClear={() => setSite(null)}
        />
        <SpaceWeatherBadge weather={null} />
      </aside>
    </div>
  );
}
