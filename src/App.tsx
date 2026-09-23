/**
 * HUD shell.
 *
 * Owns the selected satellite and the ground site; the live propagation loop,
 * globe entities and data fetching are wired in over the following milestones.
 */
import { useState } from 'react';

import { Globe } from './components/Globe';
import { NextPassFinder } from './components/NextPassFinder';
import { SatellitePicker } from './components/SatellitePicker';
import { SpaceWeatherBadge } from './components/SpaceWeatherBadge';
import { TelemetryPanel } from './components/TelemetryPanel';
import { SATELLITES } from './lib/satellites';
import type { GroundSite, SatelliteId } from './lib/types';

export default function App() {
  const [selectedId, setSelectedId] = useState<SatelliteId>('iss');
  const [site, setSite] = useState<GroundSite | null>(null);

  const satellite = SATELLITES[selectedId];

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(({ coords }) =>
      setSite({
        latitudeDeg: coords.latitude,
        longitudeDeg: coords.longitude,
        altitudeKm: (coords.altitude ?? 0) / 1000,
      }),
    );
  };

  return (
    <div className="app">
      <Globe />

      <header className="app__header">
        <h1 className="app__title">Orbital Watch</h1>
        <p className="app__tagline">Live orbits, real footprints, real space weather.</p>
      </header>

      <aside className="app__hud">
        <SatellitePicker selected={selectedId} onSelect={setSelectedId} />
        <TelemetryPanel satellite={satellite} state={null} />
        <NextPassFinder
          satellite={satellite}
          site={site}
          prediction={null}
          searching={false}
          onUseMyLocation={useMyLocation}
          onClear={() => setSite(null)}
        />
        <SpaceWeatherBadge weather={null} />
      </aside>
    </div>
  );
}
