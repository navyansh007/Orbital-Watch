/** Shared domain types for Orbital Watch. */

export type SatelliteId = 'iss' | 'goes';

export type SatelliteDefinition = {
  id: SatelliteId;
  /** Short label for the HUD. */
  label: string;
  orbitClass: 'LEO' | 'GEO';
  /** CSS colour used for this satellite's marker, trail and footprint. */
  color: string;
  blurb: string;
};

/** A propagated state vector, in the units the HUD displays. */
export type SatelliteState = {
  timestamp: Date;
  latitudeDeg: number;
  longitudeDeg: number;
  /** Height above the WGS-84 ellipsoid, in kilometres. */
  altitudeKm: number;
  /** Scalar speed, in kilometres per second. */
  velocityKmS: number;
};

/** A point on the Earth's surface, in degrees. */
export type GeoPoint = {
  latitudeDeg: number;
  longitudeDeg: number;
};

/**
 * The satellite's path over the ground, split at the present moment: where it
 * has just been, and where it is about to go.
 */
export type GroundTrack = {
  past: GeoPoint[];
  future: GeoPoint[];
};

/** A single overhead pass of a satellite as seen from a ground site. */
export type PassPrediction = {
  /** First moment the satellite clears the minimum elevation. */
  startsAt: Date;
  /** Moment of maximum elevation. */
  peaksAt: Date;
  endsAt: Date;
  maxElevationDeg: number;
};

/**
 * What a ground site can expect from a satellite.
 *
 * A LEO satellite rises and sets, so the useful answer is "the next pass". A
 * geostationary one never rises or sets — it is either permanently in view from
 * a given site or permanently below its horizon — so a pass time would be
 * meaningless there.
 */
export type VisibilityReport =
  | { kind: 'pass'; pass: PassPrediction }
  | { kind: 'always-visible'; elevationDeg: number }
  | { kind: 'never-visible' }
  | { kind: 'no-pass-in-window'; searchHours: number };

export type GroundSite = {
  latitudeDeg: number;
  longitudeDeg: number;
  /** Height above the ellipsoid, in kilometres. */
  altitudeKm: number;
};

/** Normalised response from /api/spaceweather. */
export type SpaceWeather = {
  /** NOAA planetary K-index, 0–9. */
  kp: number;
  observedAt: string;
  source: string;
};
