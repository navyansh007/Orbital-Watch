/** Satellite switcher, rendered as a top-bar nav. */
import { SATELLITE_LIST } from '../lib/satellites';
import type { SatelliteId } from '../lib/types';

type Props = {
  selected: SatelliteId;
  onSelect: (id: SatelliteId) => void;
};

export function SatellitePicker({ selected, onSelect }: Props) {
  return (
    <nav className="nav" aria-label="Tracked satellite">
      {SATELLITE_LIST.map((satellite) => {
        const active = satellite.id === selected;

        return (
          <button
            key={satellite.id}
            type="button"
            className="nav__item"
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(satellite.id)}
          >
            {/* Ties the name to the marker colour used on the globe. */}
            <span className="nav__dot" style={{ background: satellite.color }} />
            {satellite.label}
            <span className="nav__class">{satellite.orbitClass}</span>
          </button>
        );
      })}
    </nav>
  );
}
