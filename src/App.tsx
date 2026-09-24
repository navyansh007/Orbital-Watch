/**
 * Application shell.
 *
 * Owns the tracked satellite and the ground site, runs the propagation loop
 * everything else reads from, and lays the UI out as three transparent bands
 * over a full-bleed globe.
 */
import { useMemo, useState } from 'react';

import { CREDIT_CONTAINER_ID, Globe } from './components/Globe';
import { NextPassFinder } from './components/NextPassFinder';
import { RotateHint } from './components/RotateHint';
import { SatellitePicker } from './components/SatellitePicker';
import { SpaceWeatherBadge } from './components/SpaceWeatherBadge';
import { TelemetryPanel } from './components/TelemetryPanel';
import { useGroundTrack } from './hooks/useGroundTrack';
import { useLiveSatelliteState } from './hooks/useLiveSatelliteState';
import { useOrbitalElements } from './hooks/useOrbitalElements';
import { useSpaceWeather } from './hooks/useSpaceWeather';
import {
  SATELLITES,
  elevationDegAt,
  orbitalPeriodMinutes,
  reportVisibility,
} from './lib/satellites';
import type { GroundSite, SatelliteId } from './lib/types';

/** How often the pass search is redone. See the note on `report` below. */
const PASS_REFRESH_MS = 60_000;

export default function App() {
  const [selectedId, setSelectedId] = useState<SatelliteId>('iss');
  const [site, setSite] = useState<GroundSite | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const satellite = SATELLITES[selectedId];
  const { records, error: orbitError } = useOrbitalElements();
  const satrec = records?.[selectedId] ?? null;
  const { nowMs, state } = useLiveSatelliteState(satrec);
  const groundTrack = useGroundTrack(satrec, satellite, nowMs);
  const { weather, error: weatherError } = useSpaceWeather();

  const periodMinutes = satrec ? orbitalPeriodMinutes(satrec) : null;

  // Current elevation is one propagation, so it can ride the 1 Hz clock. It is
  // what distinguishes "overhead right now" from "rises in eight hours".
  const elevationDeg = useMemo(
    () => (satrec && site ? elevationDegAt(satrec, site, new Date(nowMs)) : null),
    [satrec, site, nowMs],
  );

  // A 48-hour search is a few thousand SGP4 calls — under 10 ms — but a pass
  // time does not change second to second, so it is redone once a minute
  // rather than on every tick. That also picks up hourly TLE refreshes.
  const passBucket = Math.floor(nowMs / PASS_REFRESH_MS);
  const report = useMemo(
    () =>
      satrec && site
        ? reportVisibility(satrec, satellite, site, new Date(passBucket * PASS_REFRESH_MS))
        : null,
    [satrec, satellite, site, passBucket],
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

      <header className="topbar">
        <div className="wordmark">
          Orbital<span>Watch</span>
        </div>
        <SatellitePicker selected={selectedId} onSelect={setSelectedId} />
        <SpaceWeatherBadge weather={weather} error={weatherError} />
      </header>

      <RotateHint />

      <main className="stage">
        <NextPassFinder
          satellite={satellite}
          site={site}
          report={report}
          elevationDeg={elevationDeg}
          loading={!satrec && !orbitError}
          nowMs={nowMs}
          locationError={locationError}
          onUseMyLocation={useMyLocation}
          onClear={() => setSite(null)}
        />
      </main>

      <footer className="footbar">
        <TelemetryPanel
          satellite={satellite}
          state={state}
          // A failed refresh only matters if we have nothing to propagate
          // from; TLEs stay accurate for days, so a cached orbit is still good.
          error={satrec ? null : orbitError}
          periodMinutes={periodMinutes}
        />
        <div className="sources">
          <p className="sources__list">
            <a href="https://celestrak.org" target="_blank" rel="noreferrer">
              CelesTrak
            </a>
            <span>·</span>
            <a href="https://www.swpc.noaa.gov" target="_blank" rel="noreferrer">
              NOAA SWPC
            </a>
            <span>·</span>
            SGP4
          </p>
          {/* Cesium renders its required attribution here. */}
          <div id={CREDIT_CONTAINER_ID} className="sources__credits" />
        </div>
      </footer>
    </div>
  );
}
