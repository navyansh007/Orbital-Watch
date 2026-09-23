/**
 * Cesium mount point.
 *
 * Everything WebGL lives here and nowhere else: the viewer is created once
 * against a bare <div> and torn down on unmount. React never renders into this
 * subtree, so Cesium keeps full ownership of its canvas.
 */
import { useEffect, useRef, useState } from 'react';
import { Cartesian3, Ion, Math as CesiumMath, Viewer } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { subsolarPoint } from '../lib/sun';

// Tell Cesium where its workers, assets and third-party files were staged.
// Must happen before the first Viewer is constructed.
window.CESIUM_BASE_URL = CESIUM_BASE_URL;

const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN;

const MISSING_TOKEN_MESSAGE =
  'No Cesium Ion token found. Add VITE_CESIUM_ION_TOKEN to .env.local and restart the dev server.';

/** Camera height on load, in metres — frames the full disc with room to spare. */
const INITIAL_VIEW_HEIGHT_M = 26_000_000;

export function Globe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [tilesLoaded, setTilesLoaded] = useState(false);

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

    // Real sun lighting, so the terminator on screen is the actual one.
    viewer.scene.globe.enableLighting = true;

    // ...which means the opening shot has to be the lit hemisphere, or the app
    // appears to load a black sphere.
    const { latitudeDeg, longitudeDeg } = subsolarPoint(new Date());
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(longitudeDeg, latitudeDeg, INITIAL_VIEW_HEIGHT_M),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    });

    const globe = viewer.scene.globe;
    const onTileProgress = (queued: number) => {
      if (queued === 0) setTilesLoaded(true);
    };
    globe.tileLoadProgressEvent.addEventListener(onTileProgress);

    return () => {
      viewerRef.current = null;
      if (!viewer.isDestroyed()) {
        globe.tileLoadProgressEvent.removeEventListener(onTileProgress);
        viewer.destroy();
      }
    };
  }, []);

  return (
    <div className="globe">
      <div ref={containerRef} className="globe__canvas" />
      {!error && !tilesLoaded && <p className="globe__status">Acquiring imagery…</p>}
      {error && <p className="globe__error">{error}</p>}
    </div>
  );
}
