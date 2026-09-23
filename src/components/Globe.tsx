/**
 * Cesium mount point.
 *
 * Everything WebGL lives here and nowhere else: the viewer is created once
 * against a bare <div> and torn down on unmount. React never re-renders into
 * this subtree, so Cesium keeps full ownership of its canvas.
 *
 * Satellite entities, trails and footprints are added in later milestones.
 */
import { useEffect, useRef, useState } from 'react';
import { Cartesian3, Ion, Math as CesiumMath, Viewer } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Tell Cesium where its workers, assets and third-party files were copied to.
// Must happen before the first Viewer is constructed.
window.CESIUM_BASE_URL = CESIUM_BASE_URL;

const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN;

const MISSING_TOKEN_MESSAGE =
  'No Cesium Ion token found. Add VITE_CESIUM_ION_TOKEN to .env.local and restart the dev server.';

export function Globe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // The token is known at build time, so this is a render-time fact, not state.
  const error = ION_TOKEN ? initError : MISSING_TOKEN_MESSAGE;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewerRef.current || !ION_TOKEN) return;

    Ion.defaultAccessToken = ION_TOKEN;

    let viewer: Viewer;
    try {
      viewer = new Viewer(container, {
        // A tracker HUD needs the globe and the clock, nothing else.
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
      });
    } catch (cause) {
      // Surfacing a WebGL/Cesium init failure is exactly the external-system
      // case this rule cannot distinguish; there is nowhere else to report it.
      // oxlint-disable-next-line react/set-state-in-effect
      setInitError(`Cesium failed to initialise: ${String(cause)}`);
      return;
    }

    viewerRef.current = viewer;
    viewer.scene.globe.enableLighting = true;
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(0, 15, 24_000_000),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    });

    return () => {
      viewerRef.current = null;
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  return (
    <div className="globe">
      <div ref={containerRef} className="globe__canvas" />
      {error && <p className="globe__error">{error}</p>}
    </div>
  );
}
