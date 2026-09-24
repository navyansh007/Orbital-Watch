/**
 * Advisory toast for phones held upright.
 *
 * Portrait works, but a globe wants width: turned sideways the map gets the
 * long edge of the screen and the readouts collapse to a single row. This only
 * suggests it — nothing is blocked — and it clears itself after a moment.
 *
 * Visibility is decided in CSS by orientation, so rotating the device hides it
 * without any listener here.
 */
import { useEffect, useState } from 'react';

const AUTO_DISMISS_MS = 7000;

export function RotateHint() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  return (
    <div className="rotate-hint" role="status">
      <span className="rotate-hint__icon" aria-hidden="true">⟲</span>
      Rotate your device for the best view
    </div>
  );
}
