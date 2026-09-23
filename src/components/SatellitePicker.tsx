/** Switches which satellite the HUD is following. */
import { SATELLITE_LIST } from '../lib/satellites';
import type { SatelliteId } from '../lib/types';

type Props = {
  selected: SatelliteId;
  onSelect: (id: SatelliteId) => void;
};

export function SatellitePicker({ selected, onSelect }: Props) {
  return (
    <fieldset className="picker">
      <legend className="panel__title">Tracking</legend>
      {SATELLITE_LIST.map((satellite) => (
        <label
          key={satellite.id}
          className="picker__option"
          data-active={satellite.id === selected}
        >
          <input
            type="radio"
            name="satellite"
            value={satellite.id}
            checked={satellite.id === selected}
            onChange={() => onSelect(satellite.id)}
          />
          <span className="picker__swatch" style={{ background: satellite.color }} />
          <span className="picker__label">
            {satellite.label}
            <small>{satellite.orbitClass}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
