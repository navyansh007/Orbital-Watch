/**
 * Cesium mount point.
 *
 * Everything WebGL lives here and nowhere else: the viewer is created once
 * against a bare <div> and torn down on unmount. React never renders into this
 * subtree, so Cesium keeps full ownership of its canvas.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  Entity,
  Ion,
  LabelStyle,
  Cartographic,
  Math as CesiumMath,
  PolygonHierarchy,
  PolylineDashMaterialProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  Viewer,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { footprintRing } from '../lib/footprint';
import { subsolarPoint } from '../lib/sun';
import type {
  GeoPoint,
  GroundSite,
  GroundTrack,
  SatelliteDefinition,
  SatelliteState,
} from '../lib/types';

// Tell Cesium where its workers, assets and third-party files were staged.
// Must happen before the first Viewer is constructed.
window.CESIUM_BASE_URL = CESIUM_BASE_URL;

const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN;

const MISSING_TOKEN_MESSAGE =
  'No Cesium Ion token found. Add VITE_CESIUM_ION_TOKEN to .env.local and restart the dev server.';

/** Camera height on load, in metres — frames the full disc with room to spare. */
const INITIAL_VIEW_HEIGHT_M = 26_000_000;

type Props = {
  /** The satellite being tracked, or null until its orbit has loaded. */
  tracked: { definition: SatelliteDefinition; state: SatelliteState } | null;
  /** Recent and upcoming sub-satellite path; null for orbits that hold station. */
  groundTrack: GroundTrack | null;
  /** The observer location used for pass prediction. */
  site: GroundSite | null;
  /** Called when the user clicks a point on the Earth. */
  onPickSite: (site: GroundSite) => void;
};

export function Globe({ tracked, groundTrack, site, onPickSite }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markerRef = useRef<Entity | null>(null);
  const footprintRef = useRef<Entity[]>([]);
  const trackedIdRef = useRef<string | null>(null);
  const siteMarkerRef = useRef<Entity | null>(null);

  // Held in a ref so the click handler is registered once and never needs
  // re-binding when the callback identity changes.
  const onPickSiteRef = useRef(onPickSite);
  useEffect(() => {
    onPickSiteRef.current = onPickSite;
  }, [onPickSite]);
  const trackRef = useRef<Entity[]>([]);
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

    // Dev-only handle for poking at the scene from the console. Stripped from
    // production builds by the bundler.
    if (import.meta.env.DEV) {
      (window as unknown as { cesiumViewer?: Viewer }).cesiumViewer = viewer;
    }

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

    // Click the Earth to choose an observer location. Clicks that miss the
    // globe (out in space) are ignored rather than snapped to a nearby point.
    const clickHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
      const hit = viewer.camera.pickEllipsoid(event.position, globe.ellipsoid);
      if (!hit) return;

      const carto = Cartographic.fromCartesian(hit);
      onPickSiteRef.current({
        latitudeDeg: CesiumMath.toDegrees(carto.latitude),
        longitudeDeg: CesiumMath.toDegrees(carto.longitude),
        altitudeKm: 0,
      });
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      viewerRef.current = null;
      clickHandler.destroy();
      if (!viewer.isDestroyed()) {
        globe.tileLoadProgressEvent.removeEventListener(onTileProgress);
        viewer.destroy();
      }
    };
  }, []);

  // Cesium owns its entities imperatively, so the marker is mutated in place
  // rather than re-created each tick.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!tracked) {
      if (markerRef.current) {
        viewer.entities.remove(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    const { definition, state } = tracked;
    const position = Cartesian3.fromDegrees(
      state.longitudeDeg,
      state.latitudeDeg,
      state.altitudeKm * 1000,
    );
    const color = Color.fromCssColorString(definition.color);

    const existing = markerRef.current;
    if (existing && existing.name === definition.id) {
      existing.position = new ConstantPositionProperty(position);
      return;
    }

    if (existing) viewer.entities.remove(existing);

    markerRef.current = viewer.entities.add({
      name: definition.id,
      position,
      point: {
        pixelSize: 11,
        color,
        outlineColor: Color.BLACK.withAlpha(0.6),
        outlineWidth: 2,
      },
      label: {
        text: definition.label,
        font: '600 12px ui-sans-serif, system-ui, sans-serif',
        fillColor: color,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -14),
      },
    });
  }, [tracked]);

  // Footprint: the satellite's horizon projected onto the surface, sized from
  // real geometry rather than drawn to taste.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    for (const entity of footprintRef.current) viewer.entities.remove(entity);
    footprintRef.current = [];

    if (!tracked) return;

    const { definition, state } = tracked;
    const ring = footprintRing(
      { latitudeDeg: state.latitudeDeg, longitudeDeg: state.longitudeDeg },
      state.altitudeKm,
    );
    if (ring.length < 3) return;

    const color = Color.fromCssColorString(definition.color);
    const positions = ringPositions(ring);

    footprintRef.current.push(
      viewer.entities.add({
        polygon: {
          hierarchy: new PolygonHierarchy(positions),
          material: color.withAlpha(0.1),
          arcType: ArcType.GEODESIC,
          height: SURFACE_OVERLAY_HEIGHT_M,
        },
      }),
      viewer.entities.add({
        polyline: {
          // Repeat the first point so the outline closes.
          positions: [...positions, positions[0]],
          width: 2,
          arcType: ArcType.GEODESIC,
          material: color.withAlpha(0.8),
        },
      }),
    );
  }, [tracked]);

  // Switching satellites should actually show the new one — otherwise the
  // LEO/GEO contrast happens off screen. Deliberately skipped on first load, so
  // the opening shot stays the sunlit hemisphere.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !tracked) return;

    const { definition, state } = tracked;
    const previousId = trackedIdRef.current;
    trackedIdRef.current = definition.id;
    if (previousId === null || previousId === definition.id) return;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        state.longitudeDeg,
        state.latitudeDeg,
        // Far enough out to hold the whole footprint in frame.
        definition.orbitClass === 'GEO' ? 60_000_000 : 18_000_000,
      ),
      duration: 1.8,
    });
  }, [tracked]);

  // Ground track. Redrawn wholesale, but only when the coarse resample clock
  // advances, so this is not per-tick work.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    for (const entity of trackRef.current) viewer.entities.remove(entity);
    trackRef.current = [];

    if (!groundTrack || !tracked) return;

    const color = Color.fromCssColorString(tracked.definition.color);

    const addPath = (points: GeoPoint[], style: { alpha: number; dashed: boolean }) => {
      const positions = toPositions(points);
      if (positions.length < 2) return;

      trackRef.current.push(
        viewer.entities.add({
          polyline: {
            positions,
            width: 2,
            arcType: ArcType.GEODESIC,
            material: style.dashed
              ? new PolylineDashMaterialProperty({ color: color.withAlpha(style.alpha) })
              : color.withAlpha(style.alpha),
          },
        }),
      );
    };

    addPath(groundTrack.past, { alpha: 0.85, dashed: false });
    addPath(groundTrack.future, { alpha: 0.5, dashed: true });
  }, [groundTrack, tracked]);

  // Observer marker.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (siteMarkerRef.current) {
      viewer.entities.remove(siteMarkerRef.current);
      siteMarkerRef.current = null;
    }
    if (!site) return;

    siteMarkerRef.current = viewer.entities.add({
      position: Cartesian3.fromDegrees(site.longitudeDeg, site.latitudeDeg),
      point: {
        pixelSize: 9,
        color: Color.WHITE,
        outlineColor: Color.BLACK.withAlpha(0.6),
        outlineWidth: 2,
      },
      label: {
        text: 'Ground site',
        font: '600 11px ui-sans-serif, system-ui, sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.TOP,
        pixelOffset: new Cartesian2(0, 12),
      },
    });
  }, [site]);

  return (
    <div className="globe">
      <div ref={containerRef} className="globe__canvas" />
      {!error && !tilesLoaded && <p className="globe__status">Acquiring imagery…</p>}
      {error && <p className="globe__error">{error}</p>}
    </div>
  );
}

/**
 * Height at which surface overlays (ground track, footprint) are drawn, in metres.
 *
 * These belong conceptually at height 0, but geometry lying exactly on the
 * ellipsoid z-fights with it and gets depth-culled at distance. A few kilometres
 * is invisible against a 6371 km radius and renders cleanly at every zoom level.
 *
 * Note this is deliberately NOT `clampToGround`: draping asks Cesium to load
 * terrain detail along the whole path, and an ISS track spans some 20,000 km,
 * which leaves the tile queue permanently busy and the globe never finishes
 * loading. We render on the ellipsoid instead, which is exactly the surface we
 * are using anyway.
 */
const SURFACE_OVERLAY_HEIGHT_M = 6000;

/**
 * Converts sampled ground points to Cesium positions, dropping any repeated
 * point — a stationary orbit yields duplicates, which Cesium cannot draw a
 * line through.
 */
function toPositions(points: GeoPoint[]): Cartesian3[] {
  const flattened: number[] = [];
  let previous: GeoPoint | null = null;

  for (const point of points) {
    if (
      previous &&
      Math.abs(point.latitudeDeg - previous.latitudeDeg) < 1e-6 &&
      Math.abs(point.longitudeDeg - previous.longitudeDeg) < 1e-6
    ) {
      continue;
    }
    flattened.push(point.longitudeDeg, point.latitudeDeg, SURFACE_OVERLAY_HEIGHT_M);
    previous = point;
  }

  return flattened.length >= 6 ? Cartesian3.fromDegreesArrayHeights(flattened) : [];
}

/** Ring points to Cesium positions, laid just above the surface. */
function ringPositions(ring: GeoPoint[]): Cartesian3[] {
  return Cartesian3.fromDegreesArrayHeights(
    ring.flatMap((point) => [
      point.longitudeDeg,
      point.latitudeDeg,
      SURFACE_OVERLAY_HEIGHT_M,
    ]),
  );
}
